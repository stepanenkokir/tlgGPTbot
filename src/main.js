import { Telegraf, session } from "telegraf";
import { createLogger, format, transports }from 'winston';
import {message} from "telegraf/filters"
import {code} from "telegraf/format"
import config from 'config'
import { ogg } from "./ogg.js";
import {openai} from './openai.js'
import { photo_handler } from "./photo.js";
import { voice_handler } from "./voice.js";
import {allow_user} from './AllowedUserManager.js'

const { combine, timestamp, printf } = format;
const outputOggFile= 'voices/tmpOggFile.ogg'
const bot = new Telegraf(config.get('TELEGRAM_TOKEN'))

const adminId = config.get('adminId')


const parametres = {
    image:false,
    cnt:1,
    voice:false,
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

bot.use((ctx, next) => {
    const userId = ctx.from.id;
    const userLogger = createLogger({
      format: combine(timestamp(), logFormat),
      transports: [new transports.Console(), new transports.File({ filename: `log/${userId}.log` })],
    });
  
    // Log the incoming message
    userLogger.info(`Received message: ${ctx.message.text}`);
  
    // Pass control to the next middleware
    next();
  });

// Приветственное сообщение
bot.start((ctx) => {
   

    const userId = ctx.from.id;

    console.log("Check")
  // Проверяем, является ли пользователь разрешенным
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


bot.command('voice',async (ctx) =>{
     if (!checkSession(ctx.chat.id))return;   

    if (parametres.voice){
        ctx.reply(' Голосовые ответы выключены.')
       // voice_handler.tellMe('Voice off')
       // .then(ctx.replyWithVoice({ source: outputOggFile }))
        parametres.voice = false
    }
    else
    {
        ctx.reply(' Голосовые ответы включены.')
       // voice_handler.tellMe('Voice on')
       // .then(ctx.replyWithVoice({ source: outputOggFile }))
        parametres.voice = true
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
    if (!sess) {     
      // Создание новой сессии
      newSessionArray(chatId);
     // console.log("Session create for ", chatId)
    }
   // console.log("Session is good!!", chatId)
   return true;
}

bot.command('start',async (ctx) =>{
    // Получение текущей сессии клиента
    if (!checkSession(ctx.chat.id))return;
   //console.log(session[chatId])
    await ctx.reply('Введите текст или отправьте голосовое сообщение.')
})


bot.command('image',async (ctx) =>{
    // Получение текущей сессии клиента
     if (!checkSession(ctx.chat.id))return;
    parametres.image = true
    parametres.cnt = 1
    await ctx.reply('Сейчас введите описание желаемой картинки')
})

bot.command('images',async (ctx) =>{
    // Получение текущей сессии клиента
     if (!checkSession(ctx.chat.id))return;
    parametres.image = true
    parametres.cnt = 4
    await ctx.reply('Сейчас введите описание желаемой картинки (будет 4 варианта)') 
})

bot.command('mem',async (ctx) =>{   
     if (!checkSession(ctx.chat.id))return; 
    await ctx.reply('In memory has '+countMessages(ctx.chat.id)+' messages')
})

bot.on(message('photo'), async ctx =>{
    if (!checkSession(ctx.chat.id))return; 
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
     if (!checkSession(ctx.chat.id))return;
    try {
        await ctx.reply(code('Подождите, обрабатываю...'))
        //await ctx.reply(JSON.stringify(ctx.message.voice,null,2))
        const userId = String(ctx.message.from.id)
        const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id)
        const oggPath = await ogg.create(link.href, userId,'ogg')
        const mp3Path = await ogg.toMP3(oggPath, userId)

        const text = await openai.transcription(mp3Path)


        if (parametres.image){
            await ctx.reply(code(`Я рисую: ${text}`))           
            const response = await openai.genImage(text,parametres.cnt)
               
            await ctx.reply(response[0])
            if (parametres.cnt>1){
                await ctx.reply(response[1])
                await ctx.reply(response[2])
                await ctx.reply(response[3])    
            }
            
            parametres.image = false
        }else{
            await ctx.reply(code(`Запрос: ${text}`))
            session[ctx.chat.id].messages.push({role:openai.roles.USER, content:text})
            const response = await openai.chat(session[ctx.chat.id].messages)
            session[ctx.chat.id].messages.push({role:openai.roles.ASSISTANT, content:response.content})
            if (parametres.voice){
                await  voice_handler.tellMe(response.content)                                
                .then( ctx.reply(response.content))
                .then(ctx.replyWithVoice({ source: outputOggFile }))
            }
            else
                await ctx.reply(response.content)
        }
    } catch (error) {
        await ctx.reply(code('Что-то не так. Ошибка при обработке голосового сообщения.'))
        console.log("Error while voice message",error.message)
    }
})

bot.on(message('text'), async ctx => {
     if (!checkSession(ctx.chat.id))return;
    try {
        if (parametres.image){
            await ctx.reply(code('Я рисую...'))           
            const response = await openai.genImage(ctx.message.text,parametres.cnt)
               
            await ctx.reply(response[0])
            if (parametres.cnt>1){
                await ctx.reply(response[1])
                await ctx.reply(response[2])
                await ctx.reply(response[3])    
            }
            
            parametres.image = false
        }else{
            await ctx.reply(code('Я думаю...'))
        
            session[ctx.chat.id].messages.push({role:openai.roles.USER, content:ctx.message.text})
            const response = await openai.chat(session[ctx.chat.id].messages)
            session[ctx.chat.id].messages.push({role:openai.roles.ASSISTANT, content:response.content})        
            if (parametres.voice){               
                await  voice_handler.tellMe(response.content)                                
                .then( ctx.reply(response.content))
                .then(ctx.replyWithVoice({ source: outputOggFile }))
            }
            else
                await ctx.reply(response.content)
        }
    } catch (error) {
        console.log("Error while TEXT message",error.message)
        await ctx.reply('Что-то не так. Ошибка при обработке текста.')
    }    
})

bot.launch()

process.once('SIGINT', ()=> bot.stop('SIGINT'))
process.once('SIGTERM', ()=> bot.stop('SIGTERM'))