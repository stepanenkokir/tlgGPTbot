  //settings
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
      ctx.reply('Вы не передали данные после команды.')
    }
  })

bot.command('stekirList', (ctx) => {
    const listUI = allow_user.listUserId();
    console.log(listUI)
    for (let i=0;i<listUI.length;i++){
        ctx.reply( String(listUI[i]));
    }
});
