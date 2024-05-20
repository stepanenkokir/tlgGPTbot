import { Telegraf, session, Markup } from 'telegraf'
import { message } from 'telegraf/filters'
import config from 'config'
import {allow_user} from './AllowedUserManager.js'
const adminId = config.get('adminId')

export const tlgbot = new Telegraf(config.get("TELEGRAM_TOKEN"))

// Register imageScene with Telegraf
tlgbot.use(session())

// Middleware to check if chatId is allowed
tlgbot.use((ctx, next) => {
    const chatId = ctx.chat.id
    const mwCheck = checkSession(chatId)   
    if ( mwCheck ) {
        return next();
    }
    else {
        return    
    }
})
const mainMenu = Markup.keyboard([
    ['Create image', 'Create Video','Check Token'], 
    ['Check Post']   
    ]).resize()

const welcomeMsg = async (ctx)=>{
    ctx.reply('Welcome',  mainMenu)
}

const backMsg = async (ctx)=>{
    ctx.reply('Ok',  mainMenu)
}

tlgbot.start((ctx) => {
    const chatId = ctx.chat.id
    console.log(`userId is ${chatId}`)   
    welcomeMsg( ctx )
      // Markup.keyboard([Markup.button.webApp('START', webAppURL)])   
})

// Handle button clicks
tlgbot.hears('Cancel', welcomeMsg)
tlgbot.hears('Back', backMsg)
tlgbot.hears('Create image',  (ctx) => {ctx.scene.enter('imageScene')})


const parametres = {
    image:false,
    cnt:1,
}

const getSession = (chatId)=>{    
    return session[chatId];
}

const  newSessionArray = (chatId) => {
    session[chatId] = {
        messages:[],
        created : new Date(),
        parametres : parametres
    }   
}

const  checkSession = (chatId,ctx)=>{
   // console.log("Check session for ", chatId)
    try{
        if (!allow_user.isUserAllowed(chatId)) {
            try {
               // await bot.telegram.sendMessage(chatId, "'Вы не являетесь разрешенным пользователем. \nДля получения разрешения отправьте команду\n /join \nили напишите сообщение автору @stekiva'", { parse_mode: 'HTML' });    
            } catch (error) {
                console.log("Error send MSG", error.message)
            }       
          //  console.log("GO OUT!!!")     
            return false;
        }

        //console.log(allow_user)
        //console.log(allow_user.isUserAllowed(chatId))
        const sess = getSession(chatId);

        if (!sess || (new Date() - sess.created > 30*60*1000)) {     
            console.log("New session for ", chatId)
            newSessionArray(chatId);       
        }
       // console.log("Session is good!!", chatId)
        return true;
    }catch(error){
        console.log("Error checkSession ", error.message)   
    }
}