"use client"

import styles from "./page.module.css"
import generateMap, { Datum } from "@/utils/generateMap"
import { FormEventHandler, cache, useEffect, useRef, useState } from "react"
import { QueryClient, QueryClientProvider, useQueries, useQuery } from "@tanstack/react-query"
import world from "@/utils/world.json"
import {
  RequestSchema as MapDataRequestSchema,
  ResponseSchema as MapDataResponseSchema,
  OpenAiModels,
} from "@/app/api/map-data/route"
import {
  RequestSchema as ClassifierRequestSchema,
  ResponseSchema as ClassifierResponseSchema,
} from "@/app/api/classifier/route"

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
  const [model, setModel] = useState<OpenAiModels>("gpt-3.5-turbo")
  console.log("🔍 :: model:", model)
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
      <Map question={question} model={model} />
      <form className={styles.selector}>
        <label className={styles.option}>
          <input
            type="radio"
            value="gpt-3.5-turbo"
            onChange={() => setModel("gpt-3.5-turbo")}
            checked={model === "gpt-3.5-turbo"}
          />
          GPT-3.5
        </label>
        <label className={styles.option}>
          <input
            type="radio"
            value="gpt-4"
            onChange={() => setModel("gpt-4")}
            checked={model === "gpt-4"}
          />
          GPT-4
        </label>
      </form>
    </>
  )
}

const fetchQuestionClass = cache(
  async (request: ClassifierRequestSchema | undefined): Promise<ClassifierResponseSchema> => {
    if (request === undefined) {
      Promise.reject(new Error("question undefined"))
    }
    const response = await fetch("/api/classifier", {
      method: "POST",
      body: JSON.stringify(request),
    })
    return await response.json()
  }
)
const fetchCountryAnswer = cache(
  async (request: MapDataRequestSchema): Promise<MapDataResponseSchema> => {
    const response = await fetch("/api/map-data", { method: "POST", body: JSON.stringify(request) })
    return await response.json()
  }
)

interface MapProps {
  model: OpenAiModels
  question?: string
}

const Map: React.FC<MapProps> = ({ model, question }: MapProps) => {
  const schema = useQuery({
    queryKey: [question],
    queryFn: () => fetchQuestionClass(question ? { question } : undefined),
    enabled: question !== undefined && question !== "",
  })
  const results = useQueries({
    queries:
      question && schema.data
        ? countries.map((country) => ({
            queryKey: [question, country],
            queryFn: () => fetchCountryAnswer({ model, question, country, schema: schema.data }),
          }))
        : [],
  })
  const data: Datum[] = results.map((result, index) => {
    const country = countries[index]
    switch (result.status) {
      case "success":
        const { value, note } = result.data
        return { country, value: value ?? NaN, note }
      case "loading":
        return { country, value: "loading" }
      case "error":
        return { country, value: "error" }
    }
  })

  const chartRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const map = generateMap(schema.data, question, data)
    const chart = chartRef.current
    if (map) {
      chart?.appendChild(map)
    }
    return () => {
      if (map) {
        chart?.removeChild(map)
      }
    }
  }, [chartRef, question, data, schema])
  return <div ref={chartRef}></div>
}
