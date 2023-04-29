import { Telegraf, session } from "telegraf";
import {message} from "telegraf/filters"
import {code} from "telegraf/format"
import config from 'config'
import { ogg } from "./ogg.js";
import {openai} from './openai.js'

console.log(config.get("TYPE_PROD"))
const INITIAL_SESSION = {
    messages:[],
}
const bot = new Telegraf(config.get('TELEGRAM_TOKEN'))

bot.use(session())

bot.command('new',async (ctx) =>{
    ctx.session = INITIAL_SESSION
    await ctx.reply('Начата новая сессия. Введите текст или отправьте голосовое сообщение.')
})

bot.command('start',async (ctx) =>{
    ctx.session = INITIAL_SESSION
    await ctx.reply('Введите текст или отправьте голосовое сообщение.')
})

bot.on(message('voice'), async ctx => {
    ctx.session ??= INITIAL_SESSION
    try {
        await ctx.reply(code('Подождите, обрабатываю...'))
        //await ctx.reply(JSON.stringify(ctx.message.voice,null,2))
        const userId = String(ctx.message.from.id)
        const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id)
        const oggPath = await ogg.create(link.href, userId)
        const mp3Path = await ogg.toMP3(oggPath, userId)

        const text = await openai.transcription(mp3Path)
        //await ctx.reply(code(`Запрос; ${text}`))
        ctx.session.messages.push({role:openai.roles.USER, content:text})
        const response = await openai.chat(ctx.session.messages)
        ctx.session.messages.push({role:openai.roles.ASSISTANT, content:response.content})
        await ctx.reply(response.content)
    } catch (error) {
        await ctx.reply(code('Что-то не так. Ошибка при обработке голосового сообщения.'))
        console.log("Error while voice message",error.message)
    }
    
})


bot.on(message('text'), async ctx => {
    ctx.session ??= INITIAL_SESSION
    try {
        await ctx.reply(code('Я думаю...'+ ctx.message.text))
        
        ctx.session.messages.push({role:openai.roles.USER, content:ctx.message.text})
        const response = await openai.chat(ctx.session.messages)
        ctx.session.messages.push({role:openai.roles.ASSISTANT, content:response.content})
        await ctx.reply(response.content)
    } catch (error) {
        console.log("Error while voice message",error.message)
        await ctx.reply(code('Что-то не так. Ошибка при обработке текста.'))
    }    
})

bot.launch()

process.once('SIGINT', ()=> bot.stop('SIGINT'))
process.once('SIGTERM', ()=> bot.stop('SIGTERM'))