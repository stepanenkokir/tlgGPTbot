import {readFileSync, createWriteStream,  writeFileSync} from "fs"
import axios from "axios"
import {dirname, resolve} from 'path'
import {fileURLToPath} from 'url'
import Jimp from 'jimp'

const __dirname = dirname(fileURLToPath(import.meta.url))


const createSquareImageAndMask2 = async (orPath, msPath, cropPath, maskPath) =>{

    const image_or = await Jimp.read(orPath)
    const image_ms = await Jimp.read(msPath)
    const size = Math.min(image_or.getWidth(), image_or.getHeight())  
    const x = (image_or.getWidth() - size) / 2
    const y = (image_or.getHeight() - size) / 2

    const image_cr = image_or.crop(x, y, size, size)
    await image_cr.writeAsync(cropPath)
    const image_ms_cr = image_ms.crop(x, y, size, size)

    const imgData_or = image_cr.bitmap.data
    const imgData_ms = image_ms_cr.bitmap.data

    if (imgData_or.length !== imgData_ms.length){
        console.log("Length original = ",imgData_or.length)
        console.log("Length mask = ",imgData_ms.imgData_ms)
        console.log("Error!")
        return
    }else{
        console.log("SIZE of both images equal!")
    }

    for (let i=0;i<imgData_ms.length; i+=4){        
        if (Math.abs(imgData_or[i]-imgData_ms[i])>10 
            && Math.abs(imgData_or[i+1]-imgData_ms[i+1])>10)
            imgData_ms[i+3] = 0
    }
    await image_ms_cr.writeAsync(maskPath)

}

const createSquareImageAndMask = async (srcPath, cropPath, maskPath) =>{
    const image = await Jimp.read(srcPath)
    const size = Math.min(image.getWidth(), image.getHeight())
    const radius = size / 2
    const x = (image.getWidth() - size) / 2
    const y = (image.getHeight() - size) / 2
  
    const image_cr = image.crop(x, y, size, size)
    await image_cr.writeAsync(cropPath)

    const image_mask_inv = image.circle({ radius })
  
    const imgData = image_mask_inv.bitmap.data
    for (let i=3;i<imgData.length; i+=4){
        imgData[i] = 255 - imgData[i]
    }
   
    await image_mask_inv.writeAsync(maskPath)

}

class PhotoHandler {

    constructor() {}

    async create(url, filename) {
        try {            
            const pngPath = resolve(__dirname, "../images", `${filename}.png`)            
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

    async loadImage(url) {
        const image = await Jimp.read(url)
        return image
    }

    async resizedImageBuffer(url, filename) {
        try {
            const locFile = await this.create(url, filename)                          

            console.log(locFile)

            const pngPath = resolve(__dirname, "../images", `${filename}_cr.png`)  
            const maskPath = resolve(__dirname, "../images", `${filename}_msk.png`)            
           
            await createSquareImageAndMask(locFile,pngPath,maskPath)

            return{png: pngPath, mask: maskPath}
            
        } catch (error) {

            console.log("Error resizedImageBuffer: ",error)
        }
    }

    async resizedImageBuffer2(url_orig, url_mask, filename) {
        try {
            const locFileOr = await this.create(url_orig, `${filename}_o`)
            const locFileMs = await this.create(url_mask, `${filename}_m`)

            const pngPath = resolve(__dirname, "../images", `${filename}_cr.png`)  
            const maskPath = resolve(__dirname, "../images", `${filename}_msk.png`)            
           
            await createSquareImageAndMask2(locFileOr,locFileMs,pngPath,maskPath)

            return{png: pngPath, mask: maskPath}
            
        } catch (error) {

            console.log("Error resizedImageBuffer: ",error)
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