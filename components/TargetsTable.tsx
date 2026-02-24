"use client";

import React from "react";

export interface TargetRow {
  date: string;
  title: string;
  sasaran: string;
  capaian: string;
}

export default function TargetsTable({ rows }: { rows: TargetRow[] }) {
  return (
    <div className="bg-white rounded shadow p-4">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-3 text-left text-blue-600">Tenggat</th>
            <th className="p-3 text-left">Target</th>
            <th className="p-3 text-left">Sasaran Strategis</th>
            <th className="p-3 text-left">Capaian</th>
            <th className="p-3 text-left">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t hover:bg-gray-50">
              <td className="p-3 text-blue-600">{r.date}</td>
              <td className="p-3">{r.title}</td>
              <td className="p-3">{r.sasaran}</td>
              <td className="p-3">{r.capaian}</td>
              <td className="p-3">
                <button className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded">Input</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
