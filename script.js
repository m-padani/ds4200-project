// ======================================
// MBTA Transit Inequality
// files/script.js
// ======================================

// ---------- Altair / Vega-Lite ----------
async function loadAltairCharts() {
  try {
    await vegaEmbed("#chart1", "site/altair/chart1.json", {
      actions: false,
      renderer: "svg"
    });
  } catch (error) {
    console.error("Chart 1 failed to load:", error);
    d3.select("#chart1")
      .append("p")
      .style("color", "#da291c")
      .text("Visualization 1 failed to load.");
  }

  try {
    await vegaEmbed("#chart4", "site/altair/chart4.json", {
      actions: false,
      renderer: "svg"
    });
  } catch (error) {
    console.error("Chart 4 failed to load:", error);
    d3.select("#chart4")
      .append("p")
      .style("color", "#da291c")
      .text("Visualization 4 failed to load.");
  }
}

// ---------- Visualization 2 ----------
async function drawViz2() {
  const data = await d3.json("site/data/viz2.json");

  if (!data || data.length === 0) {
    d3.select("#viz2").append("p").text("Visualization 2 data is unavailable.");
    return;
  }

  const bins = ["0-3 min", "3-6 min", "6-12 min", "12-30 min"];
  const modes = ["bus", "subway"];
  const colors = { bus: "#ed8b00", subway: "#003da5" };
  const labels = { bus: "Bus", subway: "Subway" };

  const width = 900;
  const height = 380;
  const margin = { top: 26, right: 40, bottom: 60, left: 70 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = d3.select("#viz2")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("width", "100%")
    .style("height", "auto");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x0 = d3.scaleBand().domain(bins).range([0, innerWidth]).padding(0.26);
  const x1 = d3.scaleBand().domain(modes).range([0, x0.bandwidth()]).padding(0.1);
  const y = d3.scaleLinear().domain([0.7, 0.92]).range([innerHeight, 0]);

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x0).tickSize(0));

  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${(d * 100).toFixed(0)}%`));

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -48)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .style("fill", "#243244")
    .text("Accuracy (%)");

  const tooltip = d3.select("body")
    .append("div")
    .attr("class", "custom-tooltip")
    .style("position", "absolute")
    .style("background", "rgba(15, 23, 42, 0.92)")
    .style("color", "#fff")
    .style("padding", "8px 10px")
    .style("border-radius", "8px")
    .style("font-size", "12px")
    .style("pointer-events", "none")
    .style("display", "none");

  bins.forEach(bin => {
    modes.forEach(mode => {
      const d = data.find(row => row.bin === bin && row.mode === mode);
      if (!d) return;

      g.append("rect")
        .attr("x", x0(bin) + x1(mode))
        .attr("y", y(d.accuracy))
        .attr("width", x1.bandwidth())
        .attr("height", innerHeight - y(d.accuracy))
        .attr("fill", colors[mode])
        .attr("rx", 5)
        .on("mouseover", function () {
          d3.select(this).attr("opacity", 0.84);
          tooltip.style("display", "block")
            .html(`<strong>${labels[mode]}</strong><br>${bin}<br>Accuracy: <strong>${(d.accuracy * 100).toFixed(1)}%</strong>`);
        })
        .on("mousemove", function (event) {
          tooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY - 28}px`);
        })
        .on("mouseout", function () {
          d3.select(this).attr("opacity", 1);
          tooltip.style("display", "none");
        });
    });
  });

  const legend = g.append("g")
    .attr("transform", `translate(${innerWidth - 120}, 0)`);

  modes.forEach((m, i) => {
    legend.append("rect")
      .attr("x", 0).attr("y", i * 24)
      .attr("width", 14).attr("height", 14)
      .attr("fill", colors[m]).attr("rx", 3);

    legend.append("text")
      .attr("x", 22).attr("y", i * 24 + 12)
      .style("font-size", "12px")
      .style("fill", "#243244")
      .text(labels[m]);
  });
}

// ---------- Visualization 3 ----------
async function drawViz3() {
  const data = await d3.json("site/data/viz3.json");

  if (!data || data.length === 0) {
    d3.select("#viz3").append("p").text("Visualization 3 data is unavailable.");
    return;
  }

  const wrapper = d3.select("#viz3");

  const controls = wrapper.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "8px")
    .style("margin-bottom", "12px")
    .style("flex-wrap", "wrap");

  controls.append("label")
    .attr("for", "demo-select")
    .style("font-size", "13px")
    .style("font-weight", "600")
    .style("color", "#243244")
    .text("Demographic measure:");

  controls.append("select")
    .attr("id", "demo-select")
    .style("font-size", "13px")
    .style("padding", "6px 10px")
    .style("border-radius", "8px")
    .style("border", "1px solid rgba(0,61,165,0.18)")
    .style("background", "#fff")
    .html(`
      <option value="pct_low_income">% Title VI Low-Income</option>
      <option value="pct_minority">% Title VI Minority</option>
      <option value="pct_zero_car">% Zero-Vehicle Households</option>
    `);

  const width = 900;
  const height = 360;
  const margin = { top: 34, right: 70, bottom: 42, left: 180 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const modeOrder = ["Bus", "Rapid Transit or Bus Rapid Transit", "Commuter Rail", "Ferry"];
  const shortNames = {
    "Bus": "Bus",
    "Rapid Transit or Bus Rapid Transit": "Rapid Transit",
    "Commuter Rail": "Commuter Rail",
    "Ferry": "Ferry"
  };
  const colors = {
    "Bus": "#ed8b00",
    "Rapid Transit or Bus Rapid Transit": "#003da5",
    "Commuter Rail": "#00843d",
    "Ferry": "#7c878e"
  };

  const svg = wrapper.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("width", "100%")
    .style("height", "auto");

  const title = svg.append("text")
    .attr("x", width / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .style("font-size", "15px")
    .style("font-weight", "700")
    .style("fill", "#0c2d6b");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const y = d3.scaleBand().domain(modeOrder).range([0, innerHeight]).padding(0.3);
  const x = d3.scaleLinear().domain([0, 100]).range([0, innerWidth]);

  g.append("g").call(d3.axisLeft(y).tickFormat(d => shortNames[d]).tickSize(0));
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d => `${d}%`));

  const bars = g.selectAll(".bar")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("y", d => y(d.mode))
    .attr("height", y.bandwidth())
    .attr("fill", d => colors[d.mode])
    .attr("rx", 6);

  const labels = g.selectAll(".value-label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "value-label")
    .attr("y", d => y(d.mode) + y.bandwidth() / 2 + 5)
    .style("font-size", "12px")
    .style("font-weight", "700")
    .style("fill", "#243244");

  function update(measure) {
    const titles = {
      pct_low_income: "% Title VI Low-Income Riders by Mode",
      pct_minority: "% Title VI Minority Riders by Mode",
      pct_zero_car: "% Zero-Vehicle Households by Mode"
    };

    title.text(titles[measure]);

    bars.transition().duration(500)
      .attr("x", 0)
      .attr("width", d => x(d[measure] || 0));

    labels.transition().duration(500)
      .attr("x", d => x(d[measure] || 0) + 8)
      .text(d => `${(d[measure] || 0).toFixed(1)}%`);
  }

  update("pct_low_income");
  d3.select("#demo-select").on("change", function () { update(this.value); });
}

// ---------- Visualization 5 ----------
async function drawViz5() {
  const raw = await d3.json("site/data/viz5.json");

  if (!raw || raw.length === 0) {
    d3.select("#viz5").append("p").text("Visualization 5 data is unavailable.");
    return;
  }

  const raceOrder = [
    "White",
    "Black or African American",
    "Asian",
    "Other",
    "American Indian or Alaska Native",
    "Middle Eastern or North African",
    "Native Hawaiian or other Pacific Islander",
    "Prefer not to say"
  ];
  const raceColors = ["#4f91cd", "#da291c", "#ed8b00", "#7c878e", "#00843d", "#8b5fbf", "#c96c14", "#c9d1d9"];
  const modeOrder = ["Bus", "Rapid Transit or Bus Rapid Transit", "Commuter Rail", "Ferry"];
  const shortNames = {
    "Bus": "Bus",
    "Rapid Transit or Bus Rapid Transit": "Rapid Transit",
    "Commuter Rail": "Commuter Rail",
    "Ferry": "Ferry"
  };

  const pivot = {};
  modeOrder.forEach(mode => {
    pivot[mode] = {};
    raceOrder.forEach(race => pivot[mode][race] = 0);
  });

  raw.forEach(d => {
    if (pivot[d.service_mode] && raceOrder.includes(d.category)) {
      pivot[d.service_mode][d.category] = d.weighted_percent;
    }
  });

  const stackData = modeOrder.map(mode => {
    const row = { mode };
    raceOrder.forEach(race => row[race] = pivot[mode][race]);
    return row;
  });

  const width = 980;
  const height = 380;
  const margin = { top: 54, right: 30, bottom: 42, left: 180 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const wrapper = d3.select("#viz5");

  const legend = wrapper.append("div")
    .style("display", "flex")
    .style("flex-wrap", "wrap")
    .style("gap", "12px")
    .style("margin-bottom", "14px")
    .style("font-size", "12px");

  const svg = wrapper.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("width", "100%")
    .style("height", "auto");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const y = d3.scaleBand().domain(modeOrder).range([0, innerHeight]).padding(0.28);
  const x = d3.scaleLinear().domain([0, 100]).range([0, innerWidth]);
  const color = d3.scaleOrdinal().domain(raceOrder).range(raceColors);

  g.append("g").call(d3.axisLeft(y).tickFormat(d => shortNames[d]).tickSize(0));
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d => `${d}%`));

  const stack = d3.stack().keys(raceOrder)(stackData);

  const tooltip = d3.select("body")
    .append("div")
    .attr("class", "custom-tooltip")
    .style("position", "absolute")
    .style("background", "rgba(15, 23, 42, 0.92)")
    .style("color", "#fff")
    .style("padding", "8px 10px")
    .style("border-radius", "8px")
    .style("font-size", "12px")
    .style("pointer-events", "none")
    .style("display", "none");

  let activeRace = null;

  const layers = g.selectAll(".layer")
    .data(stack)
    .enter()
    .append("g")
    .attr("class", "layer")
    .attr("data-race", d => d.key)
    .attr("fill", d => color(d.key));

  layers.selectAll("rect")
    .data(d => d)
    .enter()
    .append("rect")
    .attr("y", d => y(d.data.mode))
    .attr("x", d => x(d[0]))
    .attr("width", d => x(d[1]) - x(d[0]))
    .attr("height", y.bandwidth())
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.8)
    .on("mouseover", function (event, d) {
      const race = d3.select(this.parentNode).datum().key;
      tooltip.style("display", "block")
        .html(`<strong>${race}</strong><br>${shortNames[d.data.mode]}: ${(d[1] - d[0]).toFixed(1)}%`);
    })
    .on("mousemove", function (event) {
      tooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY - 28}px`);
    })
    .on("mouseout", function () { tooltip.style("display", "none"); });

  raceOrder.forEach((race, i) => {
    const item = legend.append("div")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "6px")
      .style("cursor", "pointer")
      .style("user-select", "none");

    item.append("div")
      .style("width", "12px")
      .style("height", "12px")
      .style("background", raceColors[i])
      .style("border-radius", "3px");

    item.append("span").text(race);

    item.on("click", function () {
      if (activeRace === race) {
        activeRace = null;
        layers.selectAll("rect").transition().duration(250).style("opacity", 1);
      } else {
        activeRace = race;
        layers.selectAll("rect").transition().duration(250)
          .style("opacity", function () {
            const layerRace = d3.select(this.parentNode).datum().key;
            return layerRace === race ? 1 : 0.14;
          });
      }
    });
  });
}

// ---------- Visualization 6 ----------
async function drawViz6() {
  const raw = await d3.json("site/data/viz6.json");

  if (!raw || raw.length === 0) {
    d3.select("#viz6").append("p").text("Visualization 6 data is unavailable.");
    return;
  }

  const lines = ["Blue", "Green-B", "Green-C", "Green-D", "Green-E", "Mattapan", "Orange", "Red"];
  const colors = {
    "Blue": "#003da5",
    "Green-B": "#00843d",
    "Green-C": "#3cbf63",
    "Green-D": "#2e9f4f",
    "Green-E": "#2fba8f",
    "Mattapan": "#8b5a2b",
    "Orange": "#ed8b00",
    "Red": "#da291c"
  };

  const parsed = raw.map(d => ({ ...d, date: new Date(d.weekly), acc: d.accuracy * 100 }));
  const byLine = {};
  lines.forEach(line => {
    byLine[line] = parsed.filter(d => d.route_id === line).sort((a, b) => a.date - b.date);
  });

  const width = 980;
  const height = 460;
  const margin = { top: 32, right: 36, bottom: 44, left: 58 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const wrapper = d3.select("#viz6");

  const legend = wrapper.append("div")
    .style("display", "flex")
    .style("flex-wrap", "wrap")
    .style("gap", "14px")
    .style("margin-bottom", "14px")
    .style("font-size", "12px");

  const svg = wrapper.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("width", "100%")
    .style("height", "auto");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleTime().domain(d3.extent(parsed, d => d.date)).range([0, innerWidth]);
  const y = d3.scaleLinear().domain([45, 100]).range([innerHeight, 0]);

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(8));

  g.append("g")
    .call(d3.axisLeft(y).ticks(6).tickFormat(d => `${d}%`));

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -42)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .style("fill", "#243244")
    .text("Accuracy (%)");

  const lineGenerator = d3.line()
    .x(d => x(d.date))
    .y(d => y(d.acc))
    .curve(d3.curveMonotoneX);

  const visible = {};
  const paths = {};

  lines.forEach(line => {
    visible[line] = true;
    paths[line] = g.append("path")
      .datum(byLine[line])
      .attr("fill", "none")
      .attr("stroke", colors[line])
      .attr("stroke-width", 1.8)
      .attr("opacity", 0.9)
      .attr("d", lineGenerator);
  });

  const hoverLine = g.append("line")
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .attr("stroke", "#7c878e")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "4,4")
    .style("display", "none");

  const hoverDots = g.append("g");

  const tooltip = d3.select("body")
    .append("div")
    .attr("class", "custom-tooltip")
    .style("position", "absolute")
    .style("background", "rgba(15, 23, 42, 0.92)")
    .style("color", "#fff")
    .style("padding", "8px 10px")
    .style("border-radius", "8px")
    .style("font-size", "12px")
    .style("line-height", "1.5")
    .style("pointer-events", "none")
    .style("display", "none");

  g.append("rect")
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .attr("fill", "transparent")
    .on("mousemove", function (event) {
      const [mx] = d3.pointer(event);
      const hoverDate = x.invert(mx);

      hoverLine.style("display", "block").attr("x1", mx).attr("x2", mx);
      hoverDots.selectAll("*").remove();

      let html = `<strong>${d3.timeFormat("%b %d, %Y")(hoverDate)}</strong><br>`;

      lines.forEach(line => {
        if (!visible[line] || byLine[line].length === 0) return;

        const closest = byLine[line].reduce((a, b) =>
          Math.abs(b.date - hoverDate) < Math.abs(a.date - hoverDate) ? b : a
        );

        if (Math.abs(closest.date - hoverDate) < 35 * 24 * 3600 * 1000) {
          hoverDots.append("circle")
            .attr("cx", x(closest.date))
            .attr("cy", y(closest.acc))
            .attr("r", 4)
            .attr("fill", colors[line])
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5);

          html += `<span style="color:${colors[line]}">■</span> ${line}: ${closest.acc.toFixed(1)}%<br>`;
        }
      });

      tooltip.style("display", "block")
        .html(html)
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mouseout", function () {
      hoverLine.style("display", "none");
      hoverDots.selectAll("*").remove();
      tooltip.style("display", "none");
    });

  lines.forEach(line => {
    const item = legend.append("div")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "6px")
      .style("cursor", "pointer")
      .style("user-select", "none");

    item.append("div")
      .style("width", "12px")
      .style("height", "12px")
      .style("background", colors[line])
      .style("border-radius", "3px");

    item.append("span").text(line);

    item.on("click", function () {
      visible[line] = !visible[line];
      paths[line].transition().duration(260).attr("opacity", visible[line] ? 0.9 : 0.08);
      item.style("opacity", visible[line] ? 1 : 0.35);
    });
  });
}

loadAltairCharts();
drawViz2();
drawViz3();
drawViz5();
drawViz6();