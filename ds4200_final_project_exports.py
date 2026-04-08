import json
from pathlib import Path

import altair as alt
import pandas as pd


# ----------------------------
# Folder setup
# ----------------------------
OUTPUT_DIR = Path("site")
DATA_DIR = OUTPUT_DIR / "data"
ALTAIR_DIR = OUTPUT_DIR / "altair"

DATA_DIR.mkdir(parents=True, exist_ok=True)
ALTAIR_DIR.mkdir(parents=True, exist_ok=True)


# ----------------------------
# Load and clean prediction data
# ----------------------------
def load_prediction_data():
    df = pd.read_csv("rapid_transit_and_bus_prediction_accuracy_data.csv")
    df.columns = df.columns.str.lower().str.strip().str.replace(" ", "_")

    df["weekly"] = pd.to_datetime(df["weekly"], errors="coerce")
    df["num_accurate_predictions"] = pd.to_numeric(
        df["num_accurate_predictions"], errors="coerce"
    )
    df["num_predictions"] = pd.to_numeric(df["num_predictions"], errors="coerce")

    df = df.dropna(subset=["weekly", "num_accurate_predictions", "num_predictions"]).copy()
    df = df[df["num_predictions"] > 0].copy()

    df["mode"] = df["mode"].astype(str).str.lower().str.strip()
    df["route_id"] = df["route_id"].astype(str).str.strip()

    df["accuracy_rate"] = df["num_accurate_predictions"] / df["num_predictions"]
    df["error_rate"] = 1 - df["accuracy_rate"]
    df["year"] = df["weekly"].dt.year
    df["month"] = df["weekly"].dt.month

    df = df.sort_values(["route_id", "weekly"]).copy()
    df["rolling_accuracy"] = df.groupby("route_id")["accuracy_rate"].transform(
        lambda x: x.rolling(4, min_periods=1).mean()
    )

    route_avg = df.groupby("route_id")["accuracy_rate"].mean()
    df["route_avg_accuracy"] = df["route_id"].map(route_avg)
    df["route_performance"] = df["route_avg_accuracy"].apply(
        lambda x: "high" if x > 0.85 else "low"
    )

    return df


# ----------------------------
# Load and clean survey data
# ----------------------------
def load_survey_data():
    survey = pd.read_csv("MBTA_2024_System-Wide_Passenger_Survey.csv")
    survey.columns = survey.columns.str.lower().str.strip().str.replace(" ", "_")
    return survey


# ----------------------------
# Viz 1: Altair export
# Prediction Accuracy Over Time
# ----------------------------
def export_chart1(df):
    time_mode = (
        df.groupby(["weekly", "mode"])
        .agg(
            tp=("num_predictions", "sum"),
            ta=("num_accurate_predictions", "sum"),
        )
        .reset_index()
    )
    time_mode["accuracy"] = (time_mode["ta"] / time_mode["tp"] * 100).round(2)

    brush = alt.selection_interval(encodings=["x"])

    base = alt.Chart(time_mode).mark_line(strokeWidth=2).encode(
        x=alt.X("weekly:T"),
        y=alt.Y("accuracy:Q"),
        color=alt.Color(
            "mode:N",
            scale=alt.Scale(domain=["bus", "subway"], range=["#e67e22", "#2980b9"]),
            legend=alt.Legend(title="Transit Mode"),
        ),
        tooltip=[
            alt.Tooltip("weekly:T", title="Week"),
            alt.Tooltip("mode:N", title="Mode"),
            alt.Tooltip("accuracy:Q", title="Accuracy (%)", format=".1f"),
        ],
    )

    upper = base.encode(
        x=alt.X("weekly:T", scale=alt.Scale(domain=brush), title=None),
        y=alt.Y(
            "accuracy:Q",
            scale=alt.Scale(domain=[65, 95]),
            title="Accuracy (%)",
        ),
    ).properties(
        width=700,
        height=280,
        title="Prediction Accuracy Over Time: Bus vs. Subway",
    )

    lower = base.properties(
        width=700,
        height=60,
    ).add_params(brush).encode(
        x=alt.X("weekly:T", title="Drag to select a date range"),
        y=alt.Y(
            "accuracy:Q",
            title=None,
            scale=alt.Scale(domain=[65, 95]),
            axis=None,
        ),
    )

    chart1 = alt.vconcat(upper, lower).configure_view(strokeWidth=0)
    chart1.save(ALTAIR_DIR / "chart1.json")


# ----------------------------
# Viz 2: D3 data export
# Accuracy by Time Horizon
#
# IMPORTANT:
# This requires a source column in your prediction dataset
# that represents prediction horizon in minutes.
# Change HORIZON_COL below to match your real column name.
# ----------------------------
def export_viz2_data(df):
    possible_horizon_cols = [
        "prediction_horizon_minutes",
        "horizon_minutes",
        "minutes_until_arrival",
        "minutes_ahead",
        "bin",
    ]

    horizon_col = None
    for col in possible_horizon_cols:
        if col in df.columns:
            horizon_col = col
            break

    if horizon_col is None:
        print("Skipping viz2 export: no prediction horizon column found.")
        return

    if horizon_col != "bin":
        df = df.copy()
        df[horizon_col] = pd.to_numeric(df[horizon_col], errors="coerce")
        df = df.dropna(subset=[horizon_col]).copy()

        df["prediction_bin"] = pd.cut(
            df[horizon_col],
            bins=[0, 3, 6, 12, 30],
            labels=["0-3 min", "3-6 min", "6-12 min", "12-30 min"],
            include_lowest=True,
            right=True,
        )
    else:
        df = df.copy()
        df["prediction_bin"] = df["bin"]

    bin_mode = (
        df.dropna(subset=["prediction_bin"])
        .groupby(["mode", "prediction_bin"])
        .agg(
            tp=("num_predictions", "sum"),
            ta=("num_accurate_predictions", "sum"),
        )
        .reset_index()
    )

    bin_mode["accuracy"] = (bin_mode["ta"] / bin_mode["tp"]).round(4)

    out = bin_mode[["mode", "prediction_bin", "accuracy"]].copy()
    out = out.rename(columns={"prediction_bin": "bin"})
    out.to_json(DATA_DIR / "viz2.json", orient="records", indent=2)


# ----------------------------
# Viz 3: D3 data export
# Rider Demographics by Mode
# ----------------------------
def export_viz3_data(survey):
    sm = survey[survey["aggregation_level"] == "Service Mode"].copy()

    demo_records = []
    mode_names = [
        "Bus",
        "Commuter Rail",
        "Rapid Transit or Bus Rapid Transit",
        "Ferry",
    ]

    for mode_name in mode_names:
        subset = sm[sm["service_mode"] == mode_name]
        rec = {"mode": mode_name}

        li = subset[
            (subset["measure"] == "Title VI Low-Income")
            & (subset["category"] == "Yes")
        ]
        if not li.empty:
            rec["pct_low_income"] = round(li.iloc[0]["weighted_percent"] * 100, 1)
        else:
            rec["pct_low_income"] = 0

        mi = subset[
            (subset["measure"] == "Title VI Minority")
            & (subset["category"] == "Yes")
        ]
        if not mi.empty:
            rec["pct_minority"] = round(mi.iloc[0]["weighted_percent"] * 100, 1)
        else:
            rec["pct_minority"] = 0

        zc = subset[
            (subset["measure"] == "Usable Cars")
            & (subset["category"] == "0")
        ]
        if not zc.empty:
            rec["pct_zero_car"] = round(zc.iloc[0]["weighted_percent"] * 100, 1)
        else:
            rec["pct_zero_car"] = 0

        demo_records.append(rec)

    with open(DATA_DIR / "viz3.json", "w", encoding="utf-8") as f:
        json.dump(demo_records, f, indent=2)


# ----------------------------
# Viz 4: Altair export
# Subway Accuracy vs Demographics
# ----------------------------
def export_chart4(df, survey):
    sub_acc = (
        df[df["mode"] == "subway"]
        .groupby("route_id")
        .agg(
            tp=("num_predictions", "sum"),
            ta=("num_accurate_predictions", "sum"),
        )
        .reset_index()
    )
    sub_acc["accuracy"] = (sub_acc["ta"] / sub_acc["tp"] * 100).round(2)

    route_to_survey = {
        "Blue": "Rapid Transit or Bus Rapid Transit - Blue Line",
        "Green-B": "Rapid Transit or Bus Rapid Transit - Green Line",
        "Green-C": "Rapid Transit or Bus Rapid Transit - Green Line",
        "Green-D": "Rapid Transit or Bus Rapid Transit - Green Line",
        "Green-E": "Rapid Transit or Bus Rapid Transit - Green Line",
        "Mattapan": "Rapid Transit or Bus Rapid Transit - Mattapan Trolley",
        "Orange": "Rapid Transit or Bus Rapid Transit - Orange Line",
        "Red": "Rapid Transit or Bus Rapid Transit - Red Line",
    }

    scatter_rows = []
    for _, row in sub_acc.iterrows():
        route = row["route_id"]
        if route not in route_to_survey:
            continue

        smode = route_to_survey[route]
        s = survey[survey["service_mode"] == smode]

        li = s[
            (s["measure"] == "Title VI Low-Income")
            & (s["category"] == "Yes")
        ]
        mi = s[
            (s["measure"] == "Title VI Minority")
            & (s["category"] == "Yes")
        ]

        scatter_rows.append(
            {
                "Line": route,
                "Accuracy (%)": row["accuracy"],
                "% Minority Riders": round(mi.iloc[0]["weighted_percent"] * 100, 1)
                if not mi.empty
                else 0,
                "% Low-Income Riders": round(li.iloc[0]["weighted_percent"] * 100, 1)
                if not li.empty
                else 0,
                "Total Predictions": int(row["tp"]),
            }
        )

    scatter_df = pd.DataFrame(scatter_rows)

    line_colors = {
        "Blue": "#003DA5",
        "Green-B": "#00843D",
        "Green-C": "#00843D",
        "Green-D": "#00843D",
        "Green-E": "#00843D",
        "Mattapan": "#8B4513",
        "Orange": "#ED8B00",
        "Red": "#DA291C",
    }

    chart4 = (
        alt.Chart(scatter_df)
        .mark_circle(opacity=0.85, stroke="#333", strokeWidth=1)
        .encode(
            x=alt.X(
                "% Minority Riders:Q",
                title="Minority Riders (%)",
                scale=alt.Scale(zero=False),
            ),
            y=alt.Y(
                "Accuracy (%):Q",
                title="Prediction Accuracy (%)",
                scale=alt.Scale(domain=[65, 95]),
            ),
            size=alt.Size(
                "Total Predictions:Q",
                scale=alt.Scale(range=[100, 600]),
                legend=alt.Legend(title="Total Predictions", format=".2s"),
            ),
            color=alt.Color(
                "Line:N",
                scale=alt.Scale(
                    domain=list(line_colors.keys()),
                    range=list(line_colors.values()),
                ),
                legend=alt.Legend(title="Subway Line"),
            ),
            tooltip=[
                alt.Tooltip("Line:N"),
                alt.Tooltip("Accuracy (%):Q", format=".1f"),
                alt.Tooltip("% Minority Riders:Q", format=".1f"),
                alt.Tooltip("% Low-Income Riders:Q", format=".1f"),
                alt.Tooltip("Total Predictions:Q", format=",.0f"),
            ],
        )
        .properties(
            width=650,
            height=350,
            title="Subway Line Prediction Accuracy vs. Minority Ridership",
        )
        .configure_view(strokeWidth=0)
    )

    chart4.save(ALTAIR_DIR / "chart4.json")


# ----------------------------
# Viz 5: D3 data export
# Racial Composition by Mode
# ----------------------------
def export_viz5_data(survey):
    sm = survey[survey["aggregation_level"] == "Service Mode"].copy()

    race = sm[sm["measure"] == "Race"][
        ["service_mode", "category", "weighted_percent"]
    ].copy()

    race = race[
        race["service_mode"].isin(
            [
                "Bus",
                "Commuter Rail",
                "Rapid Transit or Bus Rapid Transit",
                "Ferry",
            ]
        )
    ].copy()

    race["weighted_percent"] = (race["weighted_percent"] * 100).round(1)
    race.to_json(DATA_DIR / "viz5.json", orient="records", indent=2)


# ----------------------------
# Viz 6: D3 data export
# Subway Lines Over Time
# ----------------------------
def export_viz6_data(df):
    sub_ts = (
        df[df["mode"] == "subway"]
        .groupby(["weekly", "route_id"])
        .agg(
            tp=("num_predictions", "sum"),
            ta=("num_accurate_predictions", "sum"),
        )
        .reset_index()
    )

    sub_ts["accuracy"] = (sub_ts["ta"] / sub_ts["tp"]).round(4)
    sub_ts = sub_ts.dropna(subset=["accuracy"]).copy()

    dates_sorted = sorted(sub_ts["weekly"].unique())
    if not dates_sorted:
        print("Skipping viz6 export: no subway time series data.")
        return

    keep_dates = set(dates_sorted[::4] + [dates_sorted[-1]])
    sub_ts_sampled = sub_ts[sub_ts["weekly"].isin(keep_dates)].copy()
    sub_ts_sampled["weekly"] = sub_ts_sampled["weekly"].dt.strftime("%Y-%m-%d")

    out = sub_ts_sampled[["weekly", "route_id", "accuracy"]].copy()
    out.to_json(DATA_DIR / "viz6.json", orient="records", indent=2)


# ----------------------------
# Optional: export cleaned datasets
# ----------------------------
def export_cleaned_data(df, survey):
    df.to_csv(DATA_DIR / "prediction_cleaned.csv", index=False)
    survey.to_csv(DATA_DIR / "survey_cleaned.csv", index=False)


# ----------------------------
# Main
# ----------------------------
def main():
    df = load_prediction_data()
    survey = load_survey_data()

    export_cleaned_data(df, survey)
    export_chart1(df)
    export_viz2_data(df)
    export_viz3_data(survey)
    export_chart4(df, survey)
    export_viz5_data(survey)
    export_viz6_data(df)

    print("Done.")
    print(f"Files exported to: {OUTPUT_DIR.resolve()}")


if __name__ == "__main__":
    main()