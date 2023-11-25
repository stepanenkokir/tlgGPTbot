import  OpenAI from "openai"
import config from "config"
import {createReadStream, writeFileSync} from "fs"
import path from 'path'

class myOpenAI {

    roles = {
        ASSISTANT: 'assistant',
        USER: 'user',
        SYSTEM: 'system',
    }

    constructor (apiKey) {        
        this.openai = new OpenAI(
        {
            organization: "org-tUgH9aoJiNrF8mExH0EHBUW9",
            apiKey: apiKey,
        })
    }

    async chat (messages) {
        try {            
            const response = await this.openai.chat.completions.create({                         
                model:'gpt-4-1106-preview',               
                messages,
            })
            return response.choices[0].message
        } catch (e) {
            console.log("Error in GPT CHAT",e.message)
            return {content:"Ошибка открытия чата"}
        }
    }

    async genImage(message,cnt) {
        try {            
            const response = await this.openai.images.generate({
                prompt: message,
                n: cnt,               
            });
            const image_url = [];
            image_url.push(response.data[0].url);
            if (cnt>1){
                image_url.push(response.data[1].url);
                image_url.push(response.data[2].url);
                image_url.push(response.data[3].url);
            }              
            //console.log( response.data)
            return image_url
        } catch (e) {
            console.log("Error in GPT CHAT generate Image",e.message)
            return {content:"Ошибка открытия чата генерации изображения"}
        }
    }

    async getVisionImage(url) {
        try{
            console.log("URL = ", url.href)
            const response = await this.openai.chat.completions.create({
                model: "gpt-4-vision-preview",
                max_tokens: 600,
                messages: [
                  {
                    role: "user",
                    content: [
                      { type: "text", text: "What’s in this image? Answer in russian" },
                      {
                        type: "image_url",
                        image_url: {
                          //"url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg",
                          //"url":"https://api.telegram.org/file/bot6204549173:AAFLlNM3ggDJTQr8MpMNvApK3Hf_VODCoYA/photos/file_113.jpg",
                          "url":url.href,
                          "detail": "low"
                        },
                      },
                    ],
                  },
                ],
              });
              console.log(response.choices[0])
              return response.choices[0].message.content
        }catch(error){
            console.log("Error vision: ", error.message)
        }
        return null
    }

    async editImage(urls,msg) {
        try {   
            
            console.log("DRAW ", msg)
            const cntVar = 1
            const response = await this.openai.images.edit({
                image       : createReadStream(urls.png),
                mask        : createReadStream(urls.mask),
                prompt      : msg,
                n           : cntVar
            });            
            
            
            console.log(response.data[0].url)            
            const image_url = []
            for (let i=0;i<cntVar;i++){
                image_url.push(response.data[i].url)
            }
                                      
            return image_url

        } catch (e) {
            console.log("Error in GPT CHAT edit Image",e.message)
            return {content:"Ошибка открытия чата редактирования изображения"}
        }
    }

    async genImage1(message,cnt) {
        try {    
            console.log("DRAW ",message)       
            const response = await this.openai.images.generate({
                model: "dall-e-3",
                prompt: message,
                n: 1,
                size: "1024x1024",
                style: ["vivid","natural"][cnt]
            });
            const image_url = [];
            image_url.push(response.data[0].url);
            
            return image_url           
        } catch (e) {
            console.log("Error in GPT CHAT generate Image",e.message)
            return {content:"Ошибка генерации изображения"}
        }
    }

    async transcription(filepath) {
        try {            
            const response = await this.openai.audio.transcriptions.create({                
                model: 'whisper-1', 
                file: createReadStream(filepath)
            })  
    
            return response.text
        } catch (e) {
            console.log("Error in transctription",e.message)
            return {content:"Ошибка распознавания текста"}
        }
    }

    async genVoice(message,filename="output") {       
        const c_file = `./voices/ans_${filename}.mp3`
        try {           
            const speech = await this.openai.audio.speech.create({                
                model: 'tts-1', 
                input: message,
                voice:'fable',
                speed: 1
            })  
            return new Promise((resolve,reject) =>{
                const body = speech.body
                const buffers = []
                body.on('data', (chunk) => {
                    buffers.push(chunk)
                })
    
                body.on('end', () => {    
                    const audioData = Buffer.concat(buffers)                
                    writeFileSync(c_file, audioData)
                    console.log("File saved to ",c_file)
                    resolve(c_file)
                })
    
                body.on('error', (error) => {
                    console.error('Error reading response body:', error)
                    reject(error)
                })

            })
                    
        } catch (e) {
            console.log("Error in GPT CHAT genVoice",e.message)
            return {content:"Ошибка  генерации голоса"}
        }
    }
}


export const openai = new myOpenAI(config.get("OPENAI_KEY"))