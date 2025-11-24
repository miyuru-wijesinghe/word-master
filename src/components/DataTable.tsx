import React from 'react';
import type { QuizRow } from '../utils/excelParser';

interface DataTableProps {
  data: QuizRow[];
  selectedRows: number[];
  startedRow: number | null;
  onSelectRow: (index: number) => void;
  onUpdateRow?: (index: number, field: keyof QuizRow, value: string) => void;
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
}

export const DataTable: React.FC<DataTableProps> = ({ 
  data, 
  selectedRows, 
  startedRow, 
  onSelectRow,
  onEdit,
  onDelete
}) => {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No data uploaded yet. Please upload an Excel file.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto max-h-96 overflow-y-auto border border-gray-200 rounded-lg shadow-sm">
      <table className="min-w-full bg-white">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Team Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Word
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Pronunciation
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Alternative Pronunciation
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Meaning
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Word in Context
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Word Origin
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, index) => (
            <tr 
              key={index} 
              className={`hover:bg-gray-50 transition-colors duration-200 ${
                startedRow === index
                  ? 'bg-green-100 border-l-4 border-green-500 shadow-md'
                  : selectedRows.includes(index)
                  ? 'bg-blue-100 border-l-4 border-blue-500 shadow-md' 
                  : 'hover:shadow-sm'
              }`}
            >
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                {row.Team || '--'}
              </td>
              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                {row.Word}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {row.Pronunciation || '--'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {row.AlternativePronunciation || '--'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-700 max-w-xs">
                <div className="line-clamp-3" title={row.Meaning}>{row.Meaning || '--'}</div>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                <div className="line-clamp-3 italic" title={row.WordInContext}>{row.WordInContext || '--'}</div>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {row.WordOrigin || '--'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                <div className="flex gap-2 items-center">
                <button
                  onClick={() => onSelectRow(index)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    startedRow === index
                      ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg transform scale-105'
                      : selectedRows.includes(index)
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg transform scale-105'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:shadow-md'
                  }`}
                >
                  {startedRow === index ? 'Started' : selectedRows.includes(index) ? '✓ Selected' : 'Select'}
                </button>
                  {onEdit && (
                    <button
                      onClick={() => onEdit(index)}
                      className="px-3 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors text-sm"
                      title="Edit entry"
                    >
                      ✏️
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(index)}
                      className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors text-sm"
                      title="Delete entry"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
