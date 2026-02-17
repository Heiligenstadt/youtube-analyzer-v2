import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"

export const chunk = async (transcript:string, size: number): Promise<string[]> => {
    const splitter = new RecursiveCharacterTextSplitter({chunkSize: size, chunkOverlap: 100 })
    const texts = await splitter.splitText(transcript);
    return texts;
}