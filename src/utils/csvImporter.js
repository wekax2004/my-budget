import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export const importCSV = async (file, user, showToast) => {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const text = e.target.result;
    const lines = text.split('\n');
    if (lines.length < 2) return showToast('קובץ CSV ריק או לא תקין', 'error');

    // Expected headers: Date, Amount, Currency, Category, Note, Method
    // Since users might upload bank CSVs, we can try to map them or just use the simplest logic
    // For now, we support the app's own exported format
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    let count = 0;
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      // Simple CSV parsing that handles quotes
      const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
      const cols = row.map(c => c.trim().replace(/^"|"$/g, ''));
      
      if (cols.length < 2) continue;

      try {
        const dateStr = cols[0];
        const amount = parseFloat(cols[1]);
        const currency = cols[2] || 'ILS';
        const note = cols[4] || 'יובא מקובץ CSV';
        const method = cols[5] || '💳 אשראי';

        if (isNaN(amount)) continue;

        const dateObj = new Date(dateStr);
        const timestamp = isNaN(dateObj.getTime()) ? Timestamp.now() : Timestamp.fromDate(dateObj);

        await addDoc(collection(db, "transactions"), {
          amount: amount,
          originalAmount: amount,
          currency: currency,
          note: note,
          method: method,
          allowedUsers: [user.email],
          date: timestamp
        });
        count++;
      } catch (err) {
        console.error("Error parsing row", i, err);
      }
    }
    
    showToast(`${count} פעולות יובאו בהצלחה!`, 'success');
  };
  
  reader.readAsText(file);
};
