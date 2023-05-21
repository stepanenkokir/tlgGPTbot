import { Telegraf, session } from "telegraf";
import {message} from "telegraf/filters"
import {code} from "telegraf/format"
import config from 'config'
import { ogg } from "./ogg.js";
import {openai} from './openai.js'
import { photo_handler } from "./photo.js";

console.log(config.get("TYPE_PROD"))
const INITIAL_SESSION = {
    messages:[],
}
const bot = new Telegraf(config.get('TELEGRAM_TOKEN'))

bot.use(session())


// Приветственное сообщение
bot.start((ctx) => {
    checkSession(ctx.chat.id)
    ctx.reply('Привет! Для работы с чатом GPT нужно отправить текстовое или голосовое сообщение. \
    ВНИМАНИЕ. В рамках сессии чат запоминает все вопросы и ответы, чтобы использовать контекст для \
    формирования следующих ответов. Поэтому при смене темы настоятельно рекомендую обнулять историю \
    командой /new (или через меню) чтобы не захламлять память и ускорить работу чата. Удачи. Вопросы и предложения отправлять @stekiva');
  });

bot.command('new',async (ctx) =>{
    checkSession(ctx.chat.id)
    newSessionArray(ctx.chat.id)
    ctx.reply('Начата новая сессия. Введите текст или отправьте голосовое сообщение.')
   // console.log(ctx.message.chat.id)
})

bot.command('help',async (ctx) =>{
    ctx.reply('Для работы с чатом GPT нужно отправить текстовое или голосовое сообщение. \
    ВНИМАНИЕ. В рамках сессии чат запоминает все вопросы и ответы, чтобы использовать контекст для \
    формирования следующих ответов. Поэтому при смене темы настоятельно рекомендую обнулять историю \
    командой /new (или через меню) чтобы не захламлять память и ускорить работу чата. Удачи. Вопросы и предложения отправлять @stekiva')
   // console.log(ctx.message.chat.id)
})

// Функция для создания новой сессии
function newSessionArray(chatId) {
    // Создаем новую сессию и добавляем ее в объект сессий
    session[chatId] = {
        messages:[],
    };
   // console.log("Free session ", session[chatId].messages.length)
}

// Функция проверки количества сообщений
function countMessages(chatId) {    
    return session[chatId].messages.length;
}

// Функция для получения текущей сессии клиента
function getSession(chatId) {
    // Возвращаем сессию, связанную с chatId
    return session[chatId];
}


// Функция для проверки текущей сессии клиента
function checkSession(chatId) {
    const sess = getSession(chatId);
    // Проверка наличия сессии
    if (!sess) {     
      // Создание новой сессии
      newSessionArray(chatId);
     // console.log("Session create for ", chatId)
    }
   // console.log("Session is good!!", chatId)
}

bot.command('start',async (ctx) =>{
 
   
    // Получение текущей сессии клиента
    checkSession(ctx.chat.id)
   //console.log(session[chatId])
    await ctx.reply('Введите текст или отправьте голосовое сообщение.')
})

bot.command('mem',async (ctx) =>{   
    checkSession(ctx.chat.id) 
    await ctx.reply('In memory has '+countMessages(ctx.chat.id)+' messages')
})

bot.on(message('photo'), async ctx =>{
    try {
        const userId = String(ctx.message.from.id)
        const arrayPhotos = ctx.message.photo
        const lastPhoto = arrayPhotos[arrayPhotos.length -1]
        const link = await ctx.telegram.getFileLink(lastPhoto.file_id)
       // const oggPath = await ogg.create(oggPath, userId,'png')
        const ph64 = await photo_handler.toBase64(link.href, userId)
        // const message = [
        //     { role: openai.roles.USER, content: ph64 },          
        //   ]
       
        const response = await openai.crIm(ph64)
         console.log(response)
       // console.log(ph64)
      // await ctx.reply(response.content)
    } catch (e) {
        console.log("Error while photo message",e.message) 
    }
})

bot.on(message('voice'), async ctx => {
    ctx.session ??= INITIAL_SESSION
    try {
        await ctx.reply(code('Подождите, обрабатываю...'))
        //await ctx.reply(JSON.stringify(ctx.message.voice,null,2))
        const userId = String(ctx.message.from.id)
        const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id)
        const oggPath = await ogg.create(link.href, userId,'ogg')
        const mp3Path = await ogg.toMP3(oggPath, userId)

        const text = await openai.transcription(mp3Path)
        await ctx.reply(code(`Запрос; ${text}`))
        session[ctx.chat.id].messages.push({role:openai.roles.USER, content:text})
        const response = await openai.chat(session[ctx.chat.id].messages)
        session[ctx.chat.id].messages.push({role:openai.roles.ASSISTANT, content:response.content})
        await ctx.reply(response.content)
    } catch (error) {
        await ctx.reply(code('Что-то не так. Ошибка при обработке голосового сообщения.'))
        console.log("Error while voice message",error.message)
    }
})

bot.on(message('text'), async ctx => {
    checkSession(ctx.chat.id)
    try {
        await ctx.reply(code('Я думаю...'))
        
        session[ctx.chat.id].messages.push({role:openai.roles.USER, content:ctx.message.text})
        const response = await openai.chat(session[ctx.chat.id].messages)
        session[ctx.chat.id].messages.push({role:openai.roles.ASSISTANT, content:response.content})
        await ctx.reply(response.content)
    } catch (error) {
        console.log("Error while TEXT message",error.message)
        await ctx.reply(spoiler('Что-то не так. Ошибка при обработке текста.'))
    }    
})

bot.launch()

process.once('SIGINT', ()=> bot.stop('SIGINT'))
process.once('SIGTERM', ()=> bot.stop('SIGTERM'))