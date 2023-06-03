import say from 'say'
import { ogg } from "./ogg.js";



class VoiceHandler {

    constructor() {
        const voice = 'Alex'; // Voice name (specific to the text-to-speech engine installed on your system)
        const language = 'en-US'; // Language code

    }

    async tellMe(text) {

        async function transformToOgg() {
            // Convert voice message to WAV format using 'say' library
            const outputWavFile = 'voices/tmpWavFile.wav'
           
            await new Promise((resolve, reject) => {
              say.export(text, null, 0.8, outputWavFile,(err) => {
                if (err) reject(err);
                else resolve();
              });
            });
            const oggPath = await ogg.toOGG(outputWavFile)

            return oggPath
           
        }
      
        const resultPath = await transformToOgg()   
        return resultPath             
    }
}

export const voice_handler = new VoiceHandler()