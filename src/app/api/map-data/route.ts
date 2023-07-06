import { ZodError, z } from "zod"
import { Configuration, OpenAIApi } from "openai"
import { NextResponse } from "next/server"

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
})
const openai = new OpenAIApi(configuration)

const requestSchema = z.object({
  question: z.string(),
  country: z.string(),
})

export type RequestSchema = z.infer<typeof requestSchema>

const responseSchema = z.object({
  country: z.string(),
  value: z.union([z.number(), z.null()]),
  note: z.string(),
})

export type ResponseSchema = z.infer<typeof responseSchema>

export const POST = async (request: Request) => {
  try {
    const { question, country } = requestSchema.parse(await request.json())
    const chatCompletion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
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
                  {
                    type: "number",
                    description: "JSON Numeric value answering the question",
                  },
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
    try {
      console.log(chatCompletion.data.choices[0].message?.function_call?.arguments)
      const data = responseSchema.parse(
        JSON.parse(
          chatCompletion.data.choices[0].message?.function_call?.arguments?.replace(
            /(\d+)_(\d+)/,
            "$1$2"
          ) ?? "null"
        )
      )
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
