import {youtube} from './clients.js'

interface validationObj {
    valid: boolean,
    videoId: string | null,
    url?: string
}

const handleUrl = (url: string):boolean => {
    let inputUrl;
    try{
        inputUrl = new URL(url);
    }catch(error){
        console.error('error in handleUrl', error);
        return false;
    }
    return true;
}

const validateURL = (url: string): string | null => {
    if (!url) return null;
    if (!handleUrl(url)){
        return null;
    }

    const regex = /(?:youtube(?:-nocookie)?\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;   
    const match = url.match(regex)
    if (!match) {
        return null;
    }
    return match[1]!;
}

export const validateUrlExistence = async (url: string): Promise<validationObj> => {
    const videoId = validateURL(url);
    if (!videoId) return {valid: false, videoId: null};
    
    try{
        const response = await youtube.videos.list({
            part: ['snippet'],
            id: [videoId], 
        })
        if (!response.data.items || response.data.items.length === 0) {
            return { valid: false, videoId: null };
        }
    }catch(error){
        console.log('could not validate video', error)
        return {valid: false, videoId: null};
    }
    return {valid: true, videoId: videoId, url: `https://www.youtube.com/watch?v=${videoId}`};
}

