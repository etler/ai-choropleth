import { ZodError, z } from "zod"
import { Configuration, OpenAIApi } from "openai"
import { NextResponse } from "next/server"
import getCache from "@/utils/getCache"

const cache = getCache()

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
})
const openai = new OpenAIApi(configuration)

const requestSchema = z.object({
  question: z.string(),
})

export type RequestSchema = z.infer<typeof requestSchema>

const responseSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("number") }),
  z.object({ type: z.literal("boolean") }),
  z.object({ type: z.literal("enum"), enumChoices: z.array(z.string()) }),
])

export type ResponseSchema = z.infer<typeof responseSchema>

export const POST = async (request: Request) => {
  try {
    const requestJson = await request.json()
    const cachedResponse = await cache.get(JSON.stringify(requestJson))
    if (cachedResponse) {
      return NextResponse.json(JSON.parse(cachedResponse))
    }
    const { question } = requestSchema.parse(requestJson)
    const chatCompletion = await openai.createChatCompletion({
      model: "gpt-4",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
            Given a user query, call the function \`set_query_classification\` to classify the type of answer to that query
          `,
        },
        { role: "user", content: question },
      ],
      functions: [
        {
          name: "set_query_classification",
          description:
            "Return response classification for the type of answer that applies to the query",
          parameters: {
            type: "object",
            properties: {
              type: {
                type: "string",
                description: "The type of answer to respond to the query",
                enum: ["number", "boolean", "enum"],
              },
              enumChoices: {
                type: "array",
                description:
                  "Array of enum choices for possible answers to the question, or empty array if not an enum",
                items: {
                  type: "string",
                },
              },
            },
            required: ["type", "enumChoices"],
          },
        },
      ],
    })
    try {
      const data = responseSchema.parse(
        JSON.parse(chatCompletion.data.choices[0].message?.function_call?.arguments ?? "null")
      )
      await cache.set(JSON.stringify(requestJson), JSON.stringify(data))
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
