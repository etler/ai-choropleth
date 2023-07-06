import { ZodError, z } from "zod"
import { Configuration, CreateChatCompletionResponse, OpenAIApi } from "openai"
import { NextResponse } from "next/server"
import getCache from "@/utils/getCache"

const cache = getCache()

const promiseMap: Record<string, CreateChatCompletionResponse> = {}

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
})
const openai = new OpenAIApi(configuration)

const modelSchema = z.union([z.literal("gpt-4"), z.literal("gpt-3.5-turbo")])
const requestSchema = z.object({
  model: modelSchema,
  question: z.string(),
  country: z.string(),
  schema: z.discriminatedUnion("type", [
    z.object({ type: z.literal("number") }),
    z.object({ type: z.literal("boolean") }),
    z.object({ type: z.literal("enum"), enumChoices: z.array(z.string()) }),
  ]),
})

export type OpenAiModels = z.infer<typeof modelSchema>

export type RequestSchema = z.infer<typeof requestSchema>

const responseSchema = z.object({
  country: z.string(),
  value: z.union([z.number(), z.boolean(), z.string(), z.null()]),
  note: z.string(),
})

export type ResponseSchema = z.infer<typeof responseSchema>

const getValueSchema = (schema: RequestSchema["schema"]) => {
  switch (schema.type) {
    case "number":
      return {
        type: "number",
        description: "JSON Numeric value answering the question",
      }
    case "boolean":
      return {
        type: "boolean",
        description: "JSON Boolean value answering the question",
      }
    case "enum":
      return {
        type: "string",
        enum: schema.enumChoices,
        description: "JSON enum value answering the question",
      }
  }
}

export const POST = async (request: Request) => {
  try {
    const requestJson = await request.json()
    const queryKey = JSON.stringify(requestJson).replace(/\W/g, "").toLowerCase()
    const cachedResponse = await cache.get(queryKey)
    if (cachedResponse) {
      return NextResponse.json(JSON.parse(cachedResponse))
    }
    const { model, question, country, schema } = requestSchema.parse(requestJson)
    const valueSchema = getValueSchema(schema)
    const chatCompletionPromise =
      promiseMap[queryKey] ||
      openai
        .createChatCompletion({
          model,
          temperature: 0,
          messages: [
            {
              role: "system",
              content: `
            Given a user query, call the given function with an answer from your internal knowledge tailored to the country.
            If the answer is not applicable or cannot be answered reliably you MUST return null for the value
          `,
            },
            { role: "user", content: question },
          ],
          functions: [
            {
              name: "set_country_datum",
              description: "Return internal knowledge about a country",
              parameters: {
                type: "object",
                properties: {
                  country: {
                    type: "string",
                    enum: [country],
                    description: "The country name for the country data being returned",
                  },
                  value: {
                    anyOf: [
                      {
                        type: "null",
                        description: "JSON null value if there is no answer or unsure",
                      },
                      valueSchema,
                    ],
                  },
                  note: {
                    type: "string",
                    description: "Any special information to note about the answer",
                  },
                },
                required: ["country", "value", "note"],
              },
            },
          ],
        })
        .then((response) => response.data)
    promiseMap[queryKey] = chatCompletionPromise
    const chatCompletion = await chatCompletionPromise
    try {
      const data = responseSchema.parse(
        JSON.parse(
          chatCompletion.choices[0].message?.function_call?.arguments?.replace(
            /(\d+)_(\d+)/,
            "$1$2"
          ) ?? "null"
        )
      )
      await cache.set(queryKey, JSON.stringify(data))
      delete promiseMap[queryKey]
      return NextResponse.json(data)
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return new Response(`Response Parse Error: ${error.toString()}`, { status: 500 })
      }
      throw error
    }
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return new Response(`Request Parse Error: ${error.toString()}`, { status: 404 })
    }
    if (error === null || error == undefined) {
      return new Response("Unexpected Server Error", { status: 500 })
    }
    console.log(error)
    return new Response(`Server Error: ${error.toString()}`, { status: 500 })
  }
}
