import * as XLSX from 'xlsx';

export interface QuizRow {
  Team: string;
  Word: string;
  WordOrigin: string;
  Meaning: string;
  WordInContext: string;
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
        const headers = (jsonData[0] as any[]).map((h: any) => String(h || '').trim());
        
        // Flexible header matching - check if we have the required columns
        const headerMap: { [key: string]: number } = {};
        headers.forEach((header, index) => {
          const lowerHeader = String(header).toLowerCase().trim();
          if (lowerHeader.includes('team') && !headerMap['Team']) {
            headerMap['Team'] = index;
          }
          if (lowerHeader === 'word' && !headerMap['Word']) {
            headerMap['Word'] = index;
          }
          if ((lowerHeader.includes('word origin') || lowerHeader.includes('origin')) && !headerMap['WordOrigin']) {
            headerMap['WordOrigin'] = index;
          }
          if (lowerHeader === 'meaning' && !headerMap['Meaning']) {
            headerMap['Meaning'] = index;
          }
          if ((lowerHeader.includes('word in context') || lowerHeader.includes('context')) && !headerMap['WordInContext']) {
            headerMap['WordInContext'] = index;
          }
        });

        if (Object.keys(headerMap).length < 5) {
          reject(new Error('Excel file must contain columns: Team name, Word, Word Origin, Meaning, Word in context'));
          return;
        }

        // Convert data rows - skip empty rows and rows without team/word
        const quizData: QuizRow[] = [];
        let currentTeam = '';
        
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) continue;
          
          // Get values with fallback to empty string
          const teamValue = String(row[headerMap['Team']] || '').trim();
          const wordValue = String(row[headerMap['Word']] || '').trim();
          const originValue = String(row[headerMap['WordOrigin']] || '').trim();
          const meaningValue = String(row[headerMap['Meaning']] || '').trim();
          const contextValue = String(row[headerMap['WordInContext']] || '').trim();
          
          // Update current team if this row has a team value
          if (teamValue) {
            currentTeam = teamValue;
          }
          
          // Only add row if it has a word (team can be from previous row)
          if (wordValue) {
            quizData.push({
              Team: currentTeam || teamValue || '',
              Word: wordValue,
              WordOrigin: originValue,
              Meaning: meaningValue,
              WordInContext: contextValue
            });
          }
        }

        if (quizData.length === 0) {
          reject(new Error('No valid data rows found in Excel file'));
          return;
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
