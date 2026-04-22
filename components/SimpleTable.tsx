import React from "react";

export interface TableColumn {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  className?: string;
}

export default function SimpleTable({ columns, rows, renderCell }: {
  columns: TableColumn[];
  rows: any[];
  renderCell: (row: any, col: TableColumn, rowIdx: number) => React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`p-4 border-b font-semibold ${col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"} ${col.className || ""}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-4 text-center text-gray-400">Tidak ada data</td>
            </tr>
          ) : rows.map((row, i) => (
            <tr key={i} className="border-b hover:bg-gray-50">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`p-4 ${col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"}`}
                >
                  {renderCell(row, col, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
