import * as z from 'zod'
import {tool} from '@langchain/core/tools'
import{OpenAIEmbeddings} from '@langchain/openai'
import {MemoryVectorStore} from '@langchain/classic/vectorstores/memory'
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

let populatedStore: MemoryVectorStore;

export const embedAndStore = async (docUrl: string) => {
    const embeddings = new OpenAIEmbeddings({
        model: 'text-embedding-3-small'
    })
    
    const pTagSelector = 'p';
    const cheerioLoader = new CheerioWebBaseLoader(
        docUrl,
    {selector: pTagSelector}
    )
    
    const docs = await cheerioLoader.load();
    
    const s2 = performance.now();
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200
    })

    const allSplits = await splitter.splitDocuments(docs);
    console.log(`✅recursive chunk: ${(performance.now() - s2).toFixed(0)}ms, ${allSplits.length} chunks`);
    
    const vectorStore = new MemoryVectorStore(embeddings)
    await vectorStore.addDocuments(allSplits)
    populatedStore = vectorStore
    }


const retrieveSchema = z.object({query: z.string()})

export const retrieve = tool( 
    async ({query}) => {
        
        const retrievedDocs = await populatedStore.similaritySearch(query, 3);
        const serialized = retrievedDocs
      .map(doc => doc.pageContent)
      .join('\n\n');
  return serialized;
},
{
    name: 'retrieve',
    description: 'retrieve brand info related to a query',
    schema: retrieveSchema,
}
)

