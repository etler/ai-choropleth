"use client"

import styles from "./page.module.css"
import generateMap, { Datum } from "@/utils/generateMap"
import { FormEventHandler, cache, useEffect, useRef, useState } from "react"
import { QueryClient, QueryClientProvider, useQueries, useQuery } from "@tanstack/react-query"
import world from "@/utils/world.json"
import { ResponseSchema } from "@/app/api/map-data/route"

const countries = world.objects.countries.geometries.map((geometry) => geometry.properties.name)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
})

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <main className={styles.main}>
        <Container />
      </main>
    </QueryClientProvider>
  )
}

export const Container: React.FC = () => {
  const [question, setQuestion] = useState<string | undefined>()
  const inputRef = useRef<HTMLInputElement>(null)
  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    // Prevent the browser from reloading the page
    event.preventDefault()

    setQuestion(inputRef.current?.value)
  }
  return (
    <>
      <form onSubmit={handleSubmit}>
        <label>
          Question: <input name="question" ref={inputRef} />
        </label>
        <button type="submit">Start</button>
      </form>
      <Map question={question} />
    </>
  )
}

const fetchCountryAnswer = cache(
  async (question: string, country: string): Promise<ResponseSchema> => {
    const body = { question, country }
    const response = await fetch("/api/map-data", { method: "POST", body: JSON.stringify(body) })
    return await response.json()
  }
)

interface MapProps {
  question?: string
}

const Map: React.FC<MapProps> = ({ question }: MapProps) => {
  const results = useQueries({
    queries: question
      ? countries.map((country) => ({
          queryKey: [question, country] as const,
          queryFn: () => fetchCountryAnswer(question, country),
        }))
      : [],
  })
  const data: Datum[] = results.map((result, index) => {
    const country = countries[index]
    switch (result.status) {
      case "success":
        const { value } = result.data
        return { country, value: value ?? NaN }
      case "loading":
        return { country, value: "loading" }
      case "error":
        return { country, value: "error" }
    }
  })

  const chartRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const map = generateMap(question, data)
    const chart = chartRef.current
    if (map) {
      chart?.appendChild(map)
    }
    return () => {
      if (map) {
        chart?.removeChild(map)
      }
    }
  }, [chartRef, question, data])
  return <div ref={chartRef}></div>
}
