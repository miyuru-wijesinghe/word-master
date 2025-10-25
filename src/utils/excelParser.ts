import * as XLSX from 'xlsx';

export interface QuizRow {
  Round: string;
  Team: string;
  StudentName: string;
  Word: string;
}

export const parseExcelFile = async (file: File): Promise<QuizRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('No data found in file'));
          return;
        }

        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON with header row
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length < 2) {
          reject(new Error('Excel file must have at least a header row and one data row'));
          return;
        }

        // Get headers and validate
        const headers = jsonData[0] as string[];
        const expectedHeaders = ['Round', 'Team', 'StudentName', 'Word'];
        
        const hasRequiredHeaders = expectedHeaders.every(header => 
          headers.some(h => h.toLowerCase() === header.toLowerCase())
        );

        if (!hasRequiredHeaders) {
          reject(new Error('Excel file must contain columns: Round, Team, StudentName, Word'));
          return;
        }

        // Map headers to standardized names
        const headerMap: { [key: string]: string } = {};
        headers.forEach(header => {
          const lowerHeader = header.toLowerCase();
          if (lowerHeader === 'round') headerMap[header] = 'Round';
          else if (lowerHeader === 'team') headerMap[header] = 'Team';
          else if (lowerHeader === 'studentname' || lowerHeader === 'student name') headerMap[header] = 'StudentName';
          else if (lowerHeader === 'word') headerMap[header] = 'Word';
        });

        // Convert data rows
        const quizData: QuizRow[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (row.length >= 4) {
            quizData.push({
              Round: row[headers.indexOf(Object.keys(headerMap).find(h => headerMap[h] === 'Round')!)],
              Team: row[headers.indexOf(Object.keys(headerMap).find(h => headerMap[h] === 'Team')!)],
              StudentName: row[headers.indexOf(Object.keys(headerMap).find(h => headerMap[h] === 'StudentName')!)],
              Word: row[headers.indexOf(Object.keys(headerMap).find(h => headerMap[h] === 'Word')!)]
            });
          }
        }

        resolve(quizData);
      } catch (error) {
        reject(new Error(`Failed to parse Excel file: ${error}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsBinaryString(file);
  });
};
