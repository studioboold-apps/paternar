/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Menu acessivel com opcoes para adicionar evento ao Google Calendar, Apple Calendar (.ics) ou Outlook.
 */

import React from 'react';
import { Calendar, ChevronDown, Download, ExternalLink } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  buildGoogleCalendarUrl,
  buildOutlookCalendarUrl,
  downloadIcsFile,
} from '@/lib/calendar-link';

export default function AddToCalendarMenu({ activity, label = 'Adicionar à Agenda' }) {
  const googleUrl = buildGoogleCalendarUrl(activity);
  const outlookUrl = buildOutlookCalendarUrl(activity);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-colors cursor-pointer"
          title={label}
        >
          <Calendar aria-hidden="true" className="w-3.5 h-3.5" />
          <span>{label}</span>
          <ChevronDown aria-hidden="true" className="w-3 h-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-zinc-900 border-zinc-800 text-zinc-200">
        <DropdownMenuItem asChild>
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between cursor-pointer text-xs py-2 px-3 hover:bg-zinc-800 rounded-md transition-colors text-zinc-200"
          >
            <span>Google Agenda</span>
            <ExternalLink aria-hidden="true" className="w-3.5 h-3.5 text-zinc-400" />
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => downloadIcsFile(activity)}
          className="flex items-center justify-between cursor-pointer text-xs py-2 px-3 hover:bg-zinc-800 rounded-md transition-colors text-zinc-200"
        >
          <span>Apple / iCal (.ics)</span>
          <Download aria-hidden="true" className="w-3.5 h-3.5 text-zinc-400" />
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <a
            href={outlookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between cursor-pointer text-xs py-2 px-3 hover:bg-zinc-800 rounded-md transition-colors text-zinc-200"
          >
            <span>Outlook / Office</span>
            <ExternalLink aria-hidden="true" className="w-3.5 h-3.5 text-zinc-400" />
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
