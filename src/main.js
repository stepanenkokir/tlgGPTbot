import { Telegraf, session,  Markup } from "telegraf";
import { createLogger, format, transports }from 'winston';
import {message} from "telegraf/filters"
import {code} from "telegraf/format"
import config from 'config'
import { ogg } from "./ogg.js";
import {openai} from './openai.js'
import {allow_user} from './AllowedUserManager.js'
import { photo_handler } from "./photo.js"
import axios  from "axios"

const { combine, timestamp, printf } = format;
const outputOggFile= 'voices/tmpOggFile.ogg'
const bot = new Telegraf(config.get('TELEGRAM_TOKEN'))

const firstPhotoUrl = []
const firstPhotoMsg = []
const lastAwaitMsg = []

const menuNewSession    = 'Новая сессия'
const menuRole          = 'Роль'
const menuBack          = 'Назад'
const menuVoice         = 'Голос'
const menuVoiceMan      = 'Мужской'
const menuVoiceWoman    = 'Женский'
const menuVoiceRu       = 'Русский'
const menuVoiceEn       = 'Английский'
const menuVoiceSetL     = 'Задать язык'
const menuImage         = 'Картинка'
const menuImageImReal   = 'Реализм'
const menuImageImSurr   = 'Рисунок'
const menuImageImRecog  = 'Распознать'

const menuArr = [
    [menuNewSession], 
    [menuRole],
   // [menuVoice, menuImage],
   [ menuImage],
]

const voiceArr = [
    [menuVoiceMan,menuVoiceWoman], 
    [menuVoiceRu,menuVoiceEn,menuVoiceSetL],
    [menuBack],
]

const imageArr = [
    [menuImageImReal,menuImageImSurr],
    [menuImageImRecog],
    [menuBack],
]


const extraMenuAdmin    = [...menuArr,['AdminPanel']]
const mainMenu          = Markup.keyboard(menuArr).resize()
const mainMenuAdmin     = Markup.keyboard(extraMenuAdmin).resize()
const voiceMenu         = Markup.keyboard(voiceArr).resize()
const imageMenu         = Markup.keyboard(imageArr).resize()

const adminId = config.get('adminId')
const listNames = {};

const parametres = {

    image:false,
    image1:false,
    image2:false,
    vision:false,
    question:"",

    setrole:false,
    cnt:1,

    voice:false,
    voice_sex:1,
    voice_lang:'russian',
    select_lang:false,

   
}
// Log format
const logFormat = printf(({ level, message, timestamp }) => {
    return `[${timestamp}] ${level}: ${message}`;
  });

  // Create a logger instance
const logger = createLogger({
    format: combine(timestamp(), logFormat),
    transports: [
        new transports.Console({ encoding: 'utf8' }), 
        new transports.File({ filename: 'bot.log', encoding: 'utf8'  })
    ],
  });

bot.use(session())

const saveLog = (id, msg) => {
    const userLogger = createLogger({
        format: combine(timestamp(), logFormat),
        transports: [new transports.Console(), new transports.File({ filename: `log/${listNames[id]}.log` })],
      })    
      // Log the incoming message
      userLogger.info(`message: ${msg}`)
}

bot.use((ctx, next) => {
    const userId = ctx.from.id;
    if (!listNames.hasOwnProperty(userId)){
        listNames[userId] = userId+"_"+ctx.chat.first_name+"_"+ctx.chat.last_name+ '_@'+ctx.chat.username
        console.log("Create ", userId, listNames, ctx)
    }
    const chatId = ctx.chat.id
    const mwCheck = checkSession(chatId)  
    console.log(ctx.message.text, mwCheck) 
    if ( mwCheck ) {
        if (ctx && ctx.message && ctx.message.text){    
            saveLog(userId,  ctx.message.text)
        }
        return next();
    }
    else {
        return false   
    }
})

// Приветственное сообщение
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    if (allow_user.isUserAllowed(userId)) {  
        let menu = mainMenu
        console.log(String(ctx.chat.id)===String(adminId),String(ctx.chat.id),String(adminId))
        if (String(ctx.chat.id)===String(adminId)) menu = mainMenuAdmin;    
        ctx.reply('Привет! Что Вы хотите узнать?',menu);
        checkSession(userId)
    } else {
        try {
       // const resp = await ctx.reply('Вы не являетесь разрешенным пользователем. \nДля получения разрешения отправьте команду\n /join \nили напишите сообщение автору @stekiva');
            const resp = await ctx.reply("Sorry, I don't know you. \nBYE!");
        }catch(error){
            console.log("Error Bot Start ", error.message)
        }       
    }    
})


const newSession = async (ctx) =>{
     try{
        newSessionArray(ctx.chat.id)
        await removeLastMsg(ctx)
        await ctx.reply('Начата новая сессия. Введите текст или отправьте голосовое сообщение.', mainMenu)
       // console.log(ctx.message.chat.id)
    }catch(error){
        console.log("Error NER command ", error.message)
    }
}

const setRole = async (ctx) =>{
    session[ctx.chat.id].parametres.setrole = true
    await ctx.reply('Скажите, кто я сейчас?')
}

// bot.command('voice',async (ctx) =>{ 

//     if (session[ctx.chat.id].parametres.voice){
//         ctx.reply(' Голосовые ответы выключены.')
//         session[ctx.chat.id].parametres.voice = false
//     }
//     else
//     {
//         ctx.reply(' Голосовые ответы включены.')
//         session[ctx.chat.id].parametres.voice = true
//     }    
// })

// Функция для создания новой сессии

function newSessionArray(chatId) {
    // Создаем новую сессию и добавляем ее в объект сессий
    session[chatId] = {
        messages:[],
        created : new Date(),
        parametres : parametres
    }
   // console.log("Free session ", session[chatId].messages.length)
}

bot.command('image',async (ctx) =>{
     session[ctx.chat.id].parametres.image = true
     session[ctx.chat.id].parametres.cnt = 1
    lastAwaitMsg[ctx.chat.id] = await ctx.reply('Сейчас введите описание желаемой картинки')
})

bot.command('images',async (ctx) =>{
    session[ctx.chat.id].parametres.image = true
    session[ctx.chat.id].parametres.cnt = 4
    lastAwaitMsg[ctx.chat.id] = await ctx.reply('Сейчас введите описание желаемой картинки (будет 4 варианта)') 
})


bot.command('image1',async (ctx) =>{
    session[ctx.chat.id].parametres.image1 = true
    session[ctx.chat.id].parametres.cnt = 1
    lastAwaitMsg[ctx.chat.id] = await ctx.reply('Oписание реалестичной картинки.')
})

bot.command('image2',async (ctx) =>{
    session[ctx.chat.id].parametres.image1 = true
    session[ctx.chat.id].parametres.cnt = 1
    lastAwaitMsg[ctx.chat.id] = await ctx.reply('Oписание сюрреалестичной картинки.')
})


bot.command('mem',async (ctx) =>{   
    await ctx.reply('In memory has '+countMessages(ctx.chat.id)+' messages')
})

// bot.on(message('voice'), async ctx => {
//     try {
//         lastAwaitMsg[ctx.chat.id] =  await ctx.reply(code('Подождите, обрабатываю...'))       
//         const userId = String(ctx.message.from.id)
//         const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id)
//         const oggPath = await ogg.create(link.href, userId,'ogg')
//         const text = await openai.transcription(oggPath)

//         saveLog(ctx.chat.id, "VOICE: "+text)
//         await removeLastMsg(ctx)
//         await textHandler(ctx,text)

//     } catch (error) {
//         await ctx.reply(code('Что-то не так. Ошибка при обработке голосового сообщения.'))
//         console.log("Error while voice message",error.message)
//     }
// })

const downloadImage = async (url) =>{
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary');
}

bot.on( message('photo'), async ctx => {  
    try {
        const userId = String(ctx.message.from.id)
        firstPhotoMsg[ctx.chat.id] = ctx.message.caption? ctx.message.caption:""
        const arrayPhotos = ctx.message.photo
        const lastPhoto = arrayPhotos[arrayPhotos.length -1]
        firstPhotoUrl[ctx.chat.id] = await ctx.telegram.getFileLink(lastPhoto.file_id)

        if ( session[ctx.chat.id].parametres.vision ){
            await removeLastMsg(ctx)
            lastAwaitMsg[ctx.chat.id] =  await ctx.reply("ну-с, поглядим...")
            const sendMsg = `${session[ctx.chat.id].parametres.question} ${firstPhotoMsg[ctx.chat.id]}`
            const response = await openai.getVisionImage(firstPhotoUrl[ctx.chat.id],  sendMsg)
            await removeLastMsg(ctx)
            if (response){
                ctx.reply(response)
            }else{
                ctx.reply("Ничего не понятно :o((")
            }
            session[ctx.chat.id].parametres.question = false
            session[ctx.chat.id].parametres.vision = false
            return
        }
       
       const resizedPhoto = await photo_handler.resizedImageBuffer(firstPhotoUrl[ctx.chat.id], userId)

        console.log(resizedPhoto)

        lastAwaitMsg[ctx.chat.id] = await ctx.reply(code('Редактирую фото...'))
        const response = await openai.editImage(resizedPhoto,firstPhotoMsg[ctx.chat.id])
        await removeLastMsg(ctx)
        lastAwaitMsg[ctx.chat.id] = await ctx.reply(code('Загрузка фото...'))

        for (let i=0;i<response.length;i++){
            try {
                const image =  await downloadImage(response[i])
                await ctx.replyWithPhoto({source:image})
            } catch (error) {
                console.log("ERROR ",error)
                await ctx.reply(response[i])
            }
        }

        if (response.content){
            ctx.reply("Ups...", response.content) 
        }

        await removeLastMsg(ctx)  
        newSessionArray(ctx.chat.id)

    } catch (error) {
         console.log("Error while MESSAGE PHOTO",error.message)
        await ctx.reply('Что-то не так. Ошибка при обработке изображения.')
    }    
})

const removeLastMsg = async (ctx) =>{
    try {
        if (lastAwaitMsg[ctx.chat.id]?.message_id) {
            await ctx.telegram.deleteMessage(ctx.chat.id, lastAwaitMsg[ctx.chat.id].message_id)
            lastAwaitMsg[ctx.chat.id] = null
        }
    } catch (error) {
        console.log("Not data for lastAwaitMsg:",lastAwaitMsg[ctx.chat.id],error)
    }           
}

const textHandler = async (ctx, text) =>{

    await removeLastMsg(ctx)

    if (session[ctx.chat.id].parametres.setrole){
        newSessionArray(ctx.chat.id)
        session[ctx.chat.id].messages.push({role:openai.roles.SYSTEM, content:text})
        await ctx.reply("Установлена новая роль")
        session[ctx.chat.id].parametres.setrole = false
        return
    }

    // if ( text.toLowerCase().includes('что') && text.toLowerCase().includes('видишь')){
    //     lastAwaitMsg[ctx.chat.id] = await ctx.reply(code('Прикрепи фото, попробую посмотреть...'))
    //     newSessionArray(ctx.chat.id)
    //     session[ctx.chat.id].parametres.question = text
    //     session[ctx.chat.id].parametres.vision = true
    //     return
    // }

    if ( session[ctx.chat.id].parametres.image_recognize ){
        lastAwaitMsg[ctx.chat.id] = await ctx.reply(code('Прикрепи фото, попробую посмотреть...'))
       
        return
    }

    // if (session[ctx.chat.id].parametres.image1 || text.toLowerCase().includes('нарисуй')){
    //     lastAwaitMsg[ctx.chat.id] = await ctx.reply(code('Я рисую...'))
    //     const response = await openai.genImage1(text,0)
    //     await removeLastMsg(ctx)
    //     await ctx.reply(response[0])
    //     parametres.image1 = false
    //     newSessionArray(ctx.chat.id)
    //     return
    // }

    if(session[ctx.chat.id].parametres.image1){
        lastAwaitMsg[ctx.chat.id] = await ctx.reply(code('Я рисую...'))
        const response = await openai.genImage1(text,0)
        await removeLastMsg(ctx)
        await ctx.reply(response[0])        
        parametres.image1 = false
        newSessionArray(ctx.chat.id)
        return
    }

    if(session[ctx.chat.id].parametres.image2){
        lastAwaitMsg[ctx.chat.id] = await ctx.reply(code('Я рисую...'))
        const response = await openai.genImage1(text,1)
        await removeLastMsg(ctx)
        await ctx.reply(response[0])
        parametres.image2 = false
        newSessionArray(ctx.chat.id)
        return
    }

    // if (session[ctx.chat.id].parametres.image){
    //     lastAwaitMsg[ctx.chat.id] = await ctx.reply(code('Я рисую...'))
    //     const response = await openai.genImage(text,session[ctx.chat.id].parametres.cnt)
    //     await removeLastMsg(ctx)
    //     await ctx.reply(response[0])
    //     if (session[ctx.chat.id].parametres.cnt>1){
    //         await ctx.reply(response[1])
    //         await ctx.reply(response[2])
    //         await ctx.reply(response[3])
    //     }

    //     session[ctx.chat.id].parametres.image = false
    //     newSessionArray(ctx.chat.id)
    //     return
    // }

    if (session[ctx.chat.id].parametres.select_lang){
        session[ctx.chat.id].parametres.select_lang = false
        session[ctx.chat.id].parametres.voice_lang = text
    }

    lastAwaitMsg[ctx.chat.id] = await ctx.reply(code('Я думаю...'))
    session[ctx.chat.id].messages.push({role:openai.roles.USER, content: text})
    const response = await openai.chat(session[ctx.chat.id].messages)
    session[ctx.chat.id].messages.push({role:openai.roles.ASSISTANT, content:response.content})

    if (session[ctx.chat.id].parametres.voice){
        const voiceFile = await openai.genVoice(response.content, ctx.chat.id)
        console.log("Voice answer here: ",voiceFile)
        await ctx.replyWithVoice({source:voiceFile})
    } else {
        await ctx.reply(response.content)
    }
    await removeLastMsg(ctx)
}

const backMsg = async ( ctx )=>{
    session[ctx.chat.id].parametres.voice = false 

    ctx.reply('Ok',  mainMenu)
}

const selectLang = async ( ctx )=>{
    ctx.reply('Введите язык, на котором хотите получить ответ',  voiceMenu)
    session[ctx.chat.id].parametres.select_lang = true
}

const  setVoice = ( sex ) => async ( ctx )  =>{
    switch ( sex ) {
        case 'man':
            session[ctx.chat.id].parametres.voice_sex = 'man'
            break
        default:
            session[ctx.chat.id].parametres.voice_sex = 'woman'
            break
    }
}

const  setLang = ( lang ) => async ( ctx )  =>{
    switch ( lang ) {
        case 'ru':
            session[ctx.chat.id].parametres.voice_lang = 'ru'
            break
        case 'ru':
            session[ctx.chat.id].parametres.voice_lang = 'en'
            break
        default:
            session[ctx.chat.id].parametres.voice_lang = 'en'
            break
    }
}

const realImage = async ( ctx )=>{
    session[ctx.chat.id].parametres.image1 = true
}

const surrImage = async ( ctx )=>{
    session[ctx.chat.id].parametres.image2 = true
}

const aboutPhoto = async ( ctx )=>{
    ctx.reply('Прикрепите фото',  imageMenu)
    newSessionArray(ctx.chat.id)
    session[ctx.chat.id].parametres.vision = true
}

bot.hears(menuNewSession, newSession)
bot.hears(menuRole, setRole)
bot.hears(menuBack, backMsg)

bot.hears(menuVoice, async (ctx) => {  
    session[ctx.chat.id].parametres.voice = true 
    await ctx.reply('Voices  menu:', voiceMenu)
})

bot.hears(menuImage, async (ctx) => {await ctx.reply('Images  menu:', imageMenu)})

bot.hears(menuVoiceMan,     (ctx) => setVoice('man'))
bot.hears(menuVoiceWoman,   (ctx) => setVoice('woman'))
bot.hears(menuVoiceRu,      (ctx) => setLang('russian'))
bot.hears(menuVoiceEn,      (ctx) => setLang('english'))
bot.hears(menuVoiceSetL,    selectLang)

bot.hears(menuImageImReal, realImage)
bot.hears(menuImageImSurr, surrImage)
bot.hears(menuImageImRecog, aboutPhoto)

bot.on(message('text'), async ctx => {
    try {
        await textHandler(ctx,ctx.message.text)
    } catch (error) {
        console.log("Error while TEXT message",error.message)
        await ctx.reply('Что-то не так. Ошибка при обработке текста.')
    }    
})

bot.launch()

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
const  checkSession = (chatId,ctx)=>{
    console.log("Check session for ", chatId)
    try{
        if (!allow_user.isUserAllowed(chatId)) {
            // try {
            //     await bot.telegram.sendMessage(chatId, "'Вы не являетесь разрешенным пользователем.", { parse_mode: 'HTML' });    
            // } catch (error) {
            //     console.log("Error send MSG", error.message)
            // }
            return false
        }
        const sess = getSession(chatId);
        // Проверка наличия сессии
        if (!sess || (new Date() - sess.created > 30*60*1000)) {     
        // Создание новой сессии
            console.log("New session for ", chatId)
            newSessionArray(chatId)
            // console.log("Session create for ", chatId)
        }
     console.log("Session is good!!", chatId)
        return true
    }catch(error){
        console.log("Error checkSession ", error.message)   
    }
    return false
}


process.once('SIGINT', ()=> bot.stop('SIGINT'))
process.once('SIGTERM', ()=> bot.stop('SIGTERM'))