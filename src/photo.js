import {readFileSync, createWriteStream} from "fs"
import axios from "axios"
import {dirname, resolve} from 'path'
import {fileURLToPath} from 'url'
//import { removeFile } from "./utils.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

class PhotoHandler {

    constructor() {}

    async create(url, filename) {
        try {            
            const pngPath = resolve(__dirname, "../images", `${filename}.jpg`)            
            const response = await axios({
            method:'get',
            url,
            responseType:"stream"
            })

            return new Promise((resolve)=>{
                const stream = createWriteStream(pngPath)
                response.data.pipe(stream)
                stream.on('finish', ()=>resolve(pngPath))
            })
           

        } catch (e) {
            console.log( "Error in create file: ", e.message)
        }
        
    }


    async toBase64(url, filename) {
        try {
            const locFile = await this.create(url, filename)
            const imageContent = readFileSync(locFile, { encoding: 'base64' });
            return imageContent    
        } catch (error) {

            console.log("Error toBase64: ",error.message)
        }
        
    }
}

export const photo_handler = new PhotoHandler()