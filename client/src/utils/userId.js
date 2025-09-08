// utils/userId.js
export function getOrCreateUserId() {
  let userId = localStorage.getItem('userId');
  if (!userId) {
    userId = crypto.randomUUID(); // ou use alguma lib como uuidv4()
    localStorage.setItem('userId', userId);
  }
  return userId;
}