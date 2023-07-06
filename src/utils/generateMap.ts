// import d3 from "d3"
import * as d3 from "d3"
import * as topojson from "topojson"
import { Topology } from "topojson-specification"
import * as GeoJson from "geojson"
import Legend from "./colorLegend.js"
import worldJson from "./world.json"

// @ts-ignore
const world = worldJson as Topology

const countries = topojson.feature(world, world.objects.countries) as GeoJson.FeatureCollection<
  GeoJson.Point,
  GeoJson.GeoJsonProperties
>
// @ts-ignore
const countrymesh = topojson.mesh(world, world.objects.countries, (a, b) => a !== b)

export type Datum = {
  country: string
  value: number | "loading" | "error" | undefined
}

const generateMap = (title?: string, data: Datum[] = []) => {
  // Specify the chart’s dimensions.
  const width = 928
  const marginTop = 46
  const height = width / 2 + marginTop

  // Fit the projection.
  const projection = d3.geoEqualEarth().fitExtent(
    [
      [2, marginTop + 2],
      [width - 2, height],
    ],
    { type: "Sphere" }
  )
  const path = d3.geoPath(projection)

  // Index the values and create the color scale.
  const rawValuemap = new Map(data.map(({ country, value }) => [country, value]))
  const valuemap = new Map(
    data.map(({ country, value }) => [country, typeof value === "number" ? value : NaN])
  )
  const extent = d3.extent(valuemap.values()).map((value) => value ?? NaN)
  const color = d3.scaleSequential(extent, d3.interpolateYlGnBu)

  // Create the container SVG.
  const svg = d3
    .create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .attr("style", "max-width: 100%; height: auto;")

  // Append the legend.
  if (title) {
    svg
      .append("g")
      .attr("transform", "translate(20,0)")
      .append(() => Legend(color, { title, width: 260 }))
  }

  // Add a white sphere with a black border.
  svg
    .append("path")
    .datum({ type: "Sphere" })
    .attr("fill", "white")
    .attr("stroke", "currentColor")
    .attr("d", path.toString())

  // Add a path for each country and color it according te this data.
  svg
    .append("g")
    .selectAll("path")
    .data(countries.features)
    .join("path")
    .attr("fill", (d) => {
      const value = rawValuemap.get(d.properties?.name)
      switch (value) {
        case undefined:
          return "#000000"
        case "loading":
          return "#666666"
        case "error":
          return "#990000"
        case NaN:
          return "#FFFFFF"
        default:
          return color(value)
      }
    })
    .attr("d", path)
    .append("title")
    .text((d) => {
      const value = rawValuemap.get(d.properties?.name)
      const displayValue =
        value === undefined
          ? "No Data"
          : value === "loading"
          ? "Loading"
          : value === "error"
          ? "Error"
          : Number.isNaN(value)
          ? "Unknown"
          : value
      return `${d.properties?.name}\n${displayValue}`
    })

  // Add a white mesh.
  svg.append("path").datum(countrymesh).attr("fill", "none").attr("stroke", "white").attr("d", path)

  return svg.node()
}

export default generateMap
