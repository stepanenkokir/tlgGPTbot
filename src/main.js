import { Telegraf, session } from "telegraf";
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

let noRoundMask = config.get('roundMask')

const adminId = config.get('adminId')
const listNames = {};


const parametres = {
    image:false,
    image1:false,
    image2:false,
    setrole:false,
    cnt:1,
    voice:false,
    roundMask: noRoundMask
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
      });
    
      // Log the incoming message
      userLogger.info(`message: ${msg}`);
}

bot.use((ctx, next) => {
    const userId = ctx.from.id;
    if (!listNames.hasOwnProperty(userId)){
        
        listNames[userId] = userId+"_"+ctx.chat.first_name+"_"+ctx.chat.last_name+ '_@'+ctx.chat.username
       // console.log("Create ", userId, listNames, ctx)
       next()
    }
    if (ctx && ctx.message && ctx.message.text)
        saveLog(userId,  ctx.message.text)
    
  })

// Приветственное сообщение
bot.start((ctx) => {
    const userId = ctx.from.id;
    if (allow_user.isUserAllowed(userId)) {
        ctx.reply('Привет! Для работы с чатом GPT нужно отправить текстовое или голосовое сообщение. \
        ВНИМАНИЕ. В рамках сессии чат запоминает все вопросы и ответы, чтобы использовать контекст для \
        формирования следующих ответов. Поэтому при смене темы настоятельно рекомендую обнулять историю \
        командой /new (или через меню) чтобы не захламлять память и ускорить работу чата. Удачи. Вопросы и предложения отправлять @stekiva');
        checkSession(userId)
    } else {
        ctx.reply('Вы не являетесь разрешенным пользователем. \nДля получения разрешения отправьте команду\n /join \nили напишите сообщение автору @stekiva');
    }
    
  });

bot.command('join',async (ctx) =>{
    await bot.telegram.sendMessage(adminId, 'Этот пользователь хочет юзать бота\n '+ctx.chat.first_name+" "+ctx.chat.last_name+ ' @'+ctx.chat.username);
    const msgCmd = '/stekirAdd '+ctx.chat.id;
    await bot.telegram.sendMessage(adminId, msgCmd, { parse_mode: 'HTML' , disable_web_page_preview: true});
    ctx.reply("Заявка отправлена. Ждите решение.");
})

bot.command('stekirAdd', (ctx) => {
    if (String(ctx.chat.id)!==String(adminId)) return;
    const commandWithParams = ctx.message.text; // Получаем текст команды
  
    // Проверяем, содержит ли команда данные после "__"
    if (commandWithParams.includes(' ')) {
      const data = commandWithParams.split(' ')[1]; // Извлекаем данные после "__"
      ctx.reply(`Добавляем пользователя: ${data}`);
      allow_user.addUser(data);

        bot.telegram.sendMessage(data, "Теперь Вы можете пользоваться ботом. Удачи!", { parse_mode: 'HTML' });
     
    } else {
      ctx.reply('Вы не передали данные после команды.');
    }
  });


  bot.command('stekirDel', (ctx) => {
    if (ctx.chat.id!==adminId) return;
    const commandWithParams = ctx.message.text;
   
    if (commandWithParams.includes(' ')) {
      const data = commandWithParams.split(' ')[1]; 
      ctx.reply(`Удаляем пользователя: ${data}`);
      allow_user.removeUser(data);

    bot.telegram.sendMessage(data, "Вы пока не можете пользоваться ботом. @stekiva", { parse_mode: 'HTML' });
     
    } else {
      ctx.reply('Вы не передали данные после команды.');
    }
  });

bot.command('stekirList', (ctx) => {
    const listUI = allow_user.listUserId();
    console.log(listUI)
    for (let i=0;i<listUI.length;i++){
        ctx.reply( String(listUI[i]));
    }
});


bot.command('new',async (ctx) =>{
     if (!checkSession(ctx.chat.id))return;
    newSessionArray(ctx.chat.id)
    ctx.reply('Начата новая сессия. Введите текст или отправьте голосовое сообщение.')
   // console.log(ctx.message.chat.id)
})


bot.command('roundmask',async (ctx) =>{
    if (!checkSession(ctx.chat.id))return;   

    if (session[ctx.chat.id].parametres.roundMask){
        ctx.reply(' Маска в форме круга в центре картинки')
        session[ctx.chat.id].parametres.roundMask = false
    }
    else
    {       
        ctx.reply(' Указывайте маску вручную')
        session[ctx.chat.id].parametres.roundMask = true
    }    
})

bot.command('voice',async (ctx) =>{
    if (!checkSession(ctx.chat.id))return;   

    if (session[ctx.chat.id].parametres.voice){
        ctx.reply(' Голосовые ответы выключены.')
        session[ctx.chat.id].parametres.voice = false
    }
    else
    {
        ctx.reply(' Голосовые ответы включены.')
        session[ctx.chat.id].parametres.voice = true
    }    
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
        created : new Date(),
        parametres : parametres
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
function checkSession(chatId,ctx) {

    if (!allow_user.isUserAllowed(chatId)) {
        bot.telegram.sendMessage(chatId, "'Вы не являетесь разрешенным пользователем. \nДля получения разрешения отправьте команду\n /join \nили напишите сообщение автору @stekiva'", { parse_mode: 'HTML' });

        return false;
     }
    const sess = getSession(chatId);
    // Проверка наличия сессии
    if (!sess || (new Date() - sess.created > 30*60*1000)) {     
      // Создание новой сессии
      console.log("New session for ", chatId)
      newSessionArray(chatId);
     // console.log("Session create for ", chatId)
    }
   // console.log("Session is good!!", chatId)
   return true;
}


bot.command('image',async (ctx) =>{
    // Получение текущей сессии клиента
     if (!checkSession(ctx.chat.id))return;
     session[ctx.chat.id].parametres.image = true
     session[ctx.chat.id].parametres.cnt = 1
    lastAwaitMsg[ctx.chat.id] = await ctx.reply('Сейчас введите описание желаемой картинки')
})

bot.command('images',async (ctx) =>{
    // Получение текущей сессии клиента
     if (!checkSession(ctx.chat.id))return;
    session[ctx.chat.id].parametres.image = true
    session[ctx.chat.id].parametres.cnt = 4
    lastAwaitMsg[ctx.chat.id] = await ctx.reply('Сейчас введите описание желаемой картинки (будет 4 варианта)') 
})


bot.command('image1',async (ctx) =>{
    // Получение текущей сессии клиента
     if (!checkSession(ctx.chat.id))return;
    session[ctx.chat.id].parametres.image1 = true
    session[ctx.chat.id].parametres.cnt = 1
    lastAwaitMsg[ctx.chat.id] = await ctx.reply('Oписание реалестичной картинки.')
})

bot.command('role',async (ctx) =>{
    // Получение текущей сессии клиента
    if (!checkSession(ctx.chat.id))return;
    session[ctx.chat.id].parametres.setrole = true
    await ctx.reply('Скажите, кто я сейчас?')
})

bot.command('image2',async (ctx) =>{
    // Получение текущей сессии клиента
     if (!checkSession(ctx.chat.id))return;
    session[ctx.chat.id].parametres.image1 = true
    session[ctx.chat.id].parametres.cnt = 1
    lastAwaitMsg[ctx.chat.id] = await ctx.reply('Oписание сюрреалестичной картинки.')
})

bot.command('secretmenu',async (ctx) =>{
    // Получение текущей сессии клиента
     if (!checkSession(ctx.chat.id))return;
   
    await ctx.reply('скрытые варианты команд: \n \
    /role - задать роль \n \
    /roundmask - включить или выключить задание маски для отправки фото \n \
    /voice - включить или выключить голосовой ответ \n \
    /image1 - красивая натуральная картинка \n \
    /image2 - красивая ненатуральная картинка')
})

bot.command('mem',async (ctx) =>{   
     if (!checkSession(ctx.chat.id))return; 
    await ctx.reply('In memory has '+countMessages(ctx.chat.id)+' messages')
})

bot.on(message('voice'), async ctx => {
     if (!checkSession(ctx.chat.id))return;
    try {
        lastAwaitMsg[ctx.chat.id] =  await ctx.reply(code('Подождите, обрабатываю...'))       
        const userId = String(ctx.message.from.id)
        const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id)
        const oggPath = await ogg.create(link.href, userId,'ogg')
        const text = await openai.transcription(oggPath)

        saveLog(ctx.chat.id, "VOICE: "+text)
        await removeLastMsg(ctx)
        await textHandler(ctx,text)

    } catch (error) {
        await ctx.reply(code('Что-то не так. Ошибка при обработке голосового сообщения.'))
        console.log("Error while voice message",error.message)
    }
})

const downloadImage = async (url) =>{
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary');
}


bot.on('edited_message', async (ctx) => {
    // Check if it's a photo message
    if (ctx.editedMessage && ctx.editedMessage.photo && firstPhotoUrl[ctx.chat.id]) {
        // Handle edited photo logic here
        const userId = String(ctx.editedMessage.from.id);
        const msg = firstPhotoMsg[ctx.chat.id]? firstPhotoMsg[ctx.chat.id]: ctx.editedMessage.caption?ctx.editedMessage.caption:"Draw something";
        const arrayPhotos = ctx.editedMessage.photo;
        const lastPhoto = arrayPhotos[arrayPhotos.length - 1];
        const link = await ctx.telegram.getFileLink(lastPhoto.file_id);
        await removeLastMsg(ctx)
        lastAwaitMsg[ctx.chat.id] = await ctx.reply(code('Редактирую фото...'))
        
        const resizedPhoto = await photo_handler.resizedImageBuffer2(firstPhotoUrl[ctx.chat.id],link, userId);
        const response = await openai.editImage(resizedPhoto,msg)
        await removeLastMsg(ctx)
        lastAwaitMsg[ctx.chat.id] = await ctx.reply(code('Загрузка фото...'))
        for (let i=0;i<response.length;i++){
            const image =  await downloadImage(response[i])
            await ctx.replyWithPhoto({source:image})
            //await ctx.reply(response[i])             
        }
            
        if (response.content){
            ctx.reply(response.content) 
        }
       
        await removeLastMsg(ctx)  
        newSessionArray(ctx.chat.id)

        firstPhotoUrl[ctx.chat.id] = null
        firstPhotoMsg[ctx.chat.id] = null
    }
})

bot.on( message('photo'), async ctx => {
    if (!checkSession(ctx.chat.id))return;
    try {
        const userId = String(ctx.message.from.id)
        firstPhotoMsg[ctx.chat.id] = ctx.message.caption
        const arrayPhotos = ctx.message.photo
        const lastPhoto = arrayPhotos[arrayPhotos.length -1]
        firstPhotoUrl[ctx.chat.id] = await ctx.telegram.getFileLink(lastPhoto.file_id)
       
        if (session[ctx.chat.id].parametres.roundMask){
            lastAwaitMsg[ctx.chat.id] =  await ctx.reply("Ok. Для продолжения нужно отредактировать это фото. Закрасьте контрастным цветом места, которые нужно перерисовать")
            return
        }


       const resizedPhoto = await photo_handler.resizedImageBuffer(firstPhotoUrl[ctx.chat.id], userId)

        console.log(resizedPhoto)

        lastAwaitMsg[ctx.chat.id] = await ctx.reply(code('Редактирую фото...'))
        const response = await openai.editImage(resizedPhoto,firstPhotoMsg[ctx.chat.id])
        await removeLastMsg(ctx)
        lastAwaitMsg[ctx.chat.id] = await ctx.reply(code('Загруэка фото...'))
        for (let i=0;i<response.length;i++){
            
            try {
                const image =  await downloadImage(response[i])
                await ctx.replyWithPhoto({source:image})
            } catch (error) {
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
        await ctx.telegram.deleteMessage(ctx.chat.id, lastAwaitMsg[ctx.chat.id].message_id)
        lastAwaitMsg[ctx.chat.id] = null
    } catch (error) {
        console.log("Not data for lastAwaitMsg:",lastAwaitMsg[ctx.chat.id])
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

    if (session[ctx.chat.id].parametres.image1 || text.toLowerCase().includes('нарисуй')){
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

    if (session[ctx.chat.id].parametres.image){
        lastAwaitMsg[ctx.chat.id] = await ctx.reply(code('Я рисую...'))           
        const response = await openai.genImage(text,session[ctx.chat.id].parametres.cnt)
        await removeLastMsg(ctx)
        await ctx.reply(response[0])
        if (session[ctx.chat.id].parametres.cnt>1){
            await ctx.reply(response[1])
            await ctx.reply(response[2])
            await ctx.reply(response[3])    
        }
        
        session[ctx.chat.id].parametres.image = false
        newSessionArray(ctx.chat.id)
        return
    }
   
    lastAwaitMsg[ctx.chat.id] = await ctx.reply(code('Я думаю...'))        
    session[ctx.chat.id].messages.push({role:openai.roles.USER, content: text})
    const response = await openai.chat(session[ctx.chat.id].messages)
    session[ctx.chat.id].messages.push({role:openai.roles.ASSISTANT, content:response.content})        
    
    if (session[ctx.chat.id].parametres.voice || text.toLowerCase().includes('расскажи')){   
        const voiceFile = await openai.genVoice(response.content, ctx.chat.id)
        console.log("Voice answer here: ",voiceFile)
        await ctx.replyWithVoice({source:voiceFile})
    }
    else
        await ctx.reply(response.content)

    await removeLastMsg(ctx)
}

bot.on(message('text'), async ctx => {
     if (!checkSession(ctx.chat.id))return;
    try {

        await textHandler(ctx,ctx.message.text)
    
    } catch (error) {
        console.log("Error while TEXT message",error.message)
        await ctx.reply('Что-то не так. Ошибка при обработке текста.')
    }    
})

bot.launch()

process.once('SIGINT', ()=> bot.stop('SIGINT'))
process.once('SIGTERM', ()=> bot.stop('SIGTERM'))