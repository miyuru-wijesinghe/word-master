import React from 'react';
import type { QuizRow } from '../utils/excelParser';

interface DataTableProps {
  data: QuizRow[];
  selectedRows: number[];
  startedRow: number | null;
  onSelectRow: (index: number) => void;
  onUpdateRow: (index: number, field: keyof QuizRow, value: string) => void;
}

export const DataTable: React.FC<DataTableProps> = ({ data, selectedRows, startedRow, onSelectRow, onUpdateRow }) => {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No data uploaded yet. Please upload an Excel file.
      </div>
    );
  }

  // Get unique values for dropdowns
  const uniqueRounds = [...new Set(data.map(row => row.Round))].sort();
  const uniqueTeams = [...new Set(data.map(row => row.Team))].sort();

  return (
    <div className="overflow-x-auto max-h-96 overflow-y-auto border border-gray-200 rounded-lg shadow-sm">
      <table className="min-w-full bg-white">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Word
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Team
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Round
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
              className={`hover:bg-gray-50 transition-colors duration-200 ${
                startedRow === index
                  ? 'bg-green-100 border-l-4 border-green-500 shadow-md'
                  : selectedRows.includes(index)
                  ? 'bg-blue-100 border-l-4 border-blue-500 shadow-md' 
                  : 'hover:shadow-sm'
              }`}
            >
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {row.Word}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <select
                  value={row.Team}
                  onChange={(e) => onUpdateRow(index, 'Team', e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {uniqueTeams.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <select
                  value={row.StudentName || ''}
                  onChange={(e) => onUpdateRow(index, 'StudentName', e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {data
                    .filter(r => r.Team === row.Team && r.StudentName && r.StudentName.trim() !== '')
                    .map(r => r.StudentName)
                    .filter((name, idx, arr) => arr.indexOf(name) === idx)
                    .sort()
                    .map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                </select>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <select
                  value={row.Round}
                  onChange={(e) => onUpdateRow(index, 'Round', e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {uniqueRounds.map(round => (
                    <option key={round} value={round}>{round}</option>
                  ))}
                </select>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
