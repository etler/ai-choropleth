export default function Legend(
  color,
  {
    title,
    tickSize,
    width,
    height,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    ticks,
    tickFormat,
    tickValues,
  }: {
    title: string
    tickSize?: number
    width?: number
    height?: number
    marginTop?: number
    marginRight?: number
    marginBottom?: number
    marginLeft?: number
    ticks?: number
    tickFormat?: any
    tickValues?: any
  }
): SVGSVGElement | null
