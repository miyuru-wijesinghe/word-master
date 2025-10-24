import React from 'react';
import type { QuizRow } from '../utils/excelParser';

interface DataTableProps {
  data: QuizRow[];
  selectedRow: number | null;
  onSelectRow: (index: number) => void;
}

export const DataTable: React.FC<DataTableProps> = ({ data, selectedRow, onSelectRow }) => {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No data uploaded yet. Please upload an Excel file.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Round
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Student Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Word
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, index) => (
            <tr 
              key={index} 
              className={`hover:bg-gray-50 ${
                selectedRow === index ? 'bg-blue-50 border-l-4 border-blue-500' : ''
              }`}
            >
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {row.Round}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {row.StudentName}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {row.Word}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button
                  onClick={() => onSelectRow(index)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    selectedRow === index
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {selectedRow === index ? 'Selected' : 'Select'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
