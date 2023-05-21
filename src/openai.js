import { Configuration, OpenAIApi } from "openai"
import config from "config"
import {createReadStream} from "fs"


class OpenAI {

    roles = {
        ASSISTANT: 'assistant',
        USER: 'user',
        SYSTEM: 'system',
    }
    constructor (apiKey) {
        const configuration = new Configuration({
            organization: "org-tUgH9aoJiNrF8mExH0EHBUW9",
            apiKey: apiKey,
          });
          this.openai = new OpenAIApi(configuration);
    }

    async chat (messages) {
        try {
            const response = await this.openai.createChatCompletion({
                model:'gpt-3.5-turbo-0301',               
                messages,

            })

            return response.data.choices[0].message
        } catch (e) {
            console.log("Error in GPT CHAT",e.message)
            return {content:"Ошибка открытия чата"}
        }
    }


    async genImage(message,cnt) {
        try {            
            const response = await this.openai.createImage({
            prompt: message,
            n: cnt,
            size: "1024x1024",
            });
            const image_url = [];
            image_url.push(response.data.data[0].url);
            if (cnt>1){
                image_url.push(response.data.data[1].url);
                image_url.push(response.data.data[2].url);
                image_url.push(response.data.data[3].url);
            }              
            //console.log( response.data)
            return image_url
        } catch (e) {
            console.log("Error in GPT CHAT generate Image",e.message)
            return {content:"Ошибка открытия чата генерации изображения"}
        }
    }


    async crIm (messages) {
        try {
            const response = await this.openai.createCompletion({
                model: 'davinci', // Используйте соответствующую модель OpenAI
                prompt: `data:image/jpeg;base64,${messages}`,
                // max_tokens: 100 // Максимальное количество токенов для генерации
              })
                .then(response => {
                  const generatedText = response.choices[0].text.trim();
                  //console.log(generatedText);
                  return "I HAVE A RESULTAT!!!!"
                 
                })
                .catch(error => {
                  console.error('Ошибка:', error.message);
                });


        } catch (e) {
            console.log("Error in GPT CHAT create Image",e.message)
            return {content:"Ошибка открытия чата"}
        }
    }

    async transcription(filepath) {
        try {
            
            const response = await this.openai.createTranscription(
                createReadStream(filepath), 'whisper-1'
            )
            return response.data.text

        } catch (e) {
            console.log("Error in transctription",e.message)
            return {content:"Ошибка распознавания текста"}
        }
    }

    async createImageSend (file) {
        const axios = require('axios');
        const FormData = require('form-data');
        const fs = require('fs');

        async function createImage(prompt, model, apiKey) {
            const url = 'https://api.openai.com/v1/images/generations';

            const formData = new FormData();
            formData.append('model', model);
            formData.append('prompt', prompt);
            formData.append('num_images', 1);

            const headers = {
                'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
                'Authorization': `Bearer ${apiKey}`
            };

            try {
                const response = await axios.post(url, formData, { headers });
                const image = response.data.data[0].url;
                return image;
            } catch (error) {
                console.error(error);
                return null;
            }
        }

        // Пример использования функции
        const prompt = 'A beautiful sunset over the ocean';
        const model = 'image-alpha-001';
        const apiKey = 'YOUR_API_KEY';

        createImage(prompt, model, apiKey)
        .then(image => {
            if (image) {
            console.log(`Создано изображение: ${image}`);
            // Далее можно загрузить изображение по URL
            } else {
            console.log('Не удалось создать изображение');
            }
        });
    }
}

export const openai = new OpenAI(config.get("OPENAI_KEY"))