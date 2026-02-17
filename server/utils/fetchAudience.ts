import { youtube } from "./clients.js";

interface videoStats {
    viewCount?: string | null | undefined,
    likeCount?: string | null | undefined,
    commentCount?: string | null | undefined,
    favoriteCount?: string | null | undefined
}

export const fetchComments = async (videoId: string): Promise<string[] | null> => {

   try{ 
    
    const comments = await youtube.commentThreads.list({
        part: ['snippet'],
        videoId: videoId,
        maxResults: 100,
        order: 'relevance',
        textFormat: 'plainText'
    })

    if (!comments.data.items || comments.data.items.length === 0) {                                                                       
        return null;                                                                                                                               
    }

    const commentTexts = comments.data.items.map(item => item.snippet?.topLevelComment?.snippet?.textDisplay).filter(Boolean) as string[]; 
    return commentTexts;

   }catch(error){
    console.error('there was a problem retrieving comments', error)
    return null
   }
}

export const fetchStats = async (videoId: string): Promise<videoStats | null> => {
    try{

        const stats = await youtube.videos.list({
            id: [videoId],
            part: ['statistics']
        })

        if (!stats.data.items|| stats.data.items.length === 0) {
            return null;
        }

        const statistics = stats.data.items[0]!.statistics;
        if (!statistics) return null;  
        return statistics;
        
    }catch(error){
       console.error('could not retrieve stats in fetchStats', error)
       return null;
    }
}