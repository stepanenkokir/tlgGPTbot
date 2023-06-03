import fs from 'fs';
import config from 'config'

const allowedUsersFilePath = config.get('listUsers')

class AllowedUsersManager {
  constructor(filePath) {
    this.filePath = filePath;
    this.allowedUserIds = [];
    this.readAllowedUserIds();
  }

  readAllowedUserIds() {
    try {
      const data = fs.readFileSync(this.filePath, 'utf8');
      this.allowedUserIds = JSON.parse(data);
    } catch (err) {
      console.error(`Ошибка чтения файла ${this.filePath}:`, err);
    }
  }

  writeAllowedUserIds() {
    try {
      const data = JSON.stringify(this.allowedUserIds);
      fs.writeFileSync(this.filePath, data, 'utf8');
    } catch (err) {
      console.error(`Ошибка записи файла ${this.filePath}:`, err);
    }
  }

  addUser(userId) {
    if (!this.allowedUserIds.includes(userId)) {
     console.log(this.allowedUserIds)
      this.allowedUserIds.push(userId);
      this.writeAllowedUserIds();
    }
  }

  removeUser(userId) {
    const index = this.allowedUserIds.indexOf(userId);
    if (index !== -1) {
      this.allowedUserIds.splice(index, 1);
      this.writeAllowedUserIds();
    }
  }

  isUserAllowed(userId) {
    console.log("Before check",userId,this.allowedUserIds)
    return this.allowedUserIds.includes(userId);
  }
}
export const allow_user = new AllowedUsersManager(allowedUsersFilePath)

