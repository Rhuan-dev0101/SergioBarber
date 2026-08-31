'use client'

import React, { memo } from 'react'
import {
  User, Coffee, CheckCircle2, Scissors, Calendar, Plus, Repeat, Zap, DollarSign, ChevronRight, Clock, Lock, Unlock
} from 'lucide-react'
import { apptShortCode, getLocalDateStr } from '@/lib/utils'
import { isRecurringReservationActiveOnDate } from '@/lib/booking'

interface AgendaTimelineProps {
  appointments: any[]
  recurringReservations: any[]
  barbers: any[]
  workingHours: any[]
  daysOff: any[]
  blockedTimes: any[]
  selectedAgendaDate: string
  selectedBarberFilter: string
  userRole: string | null
  currentUser: any
  formatTime: (dateStr: string) => string
  getAppointmentPrice: (appt: any) => number
  onSelectAgendaAppt: (appt: any) => void
  onOpenWalkInModal: (barberId?: string, defaultTime?: string) => void
  onOpenCheckoutModal: () => void
  onToggleBlockSlot: (barberId: string, slotStr: string, existingBlock: any | null) => void
}

export const AgendaTimeline = memo(function AgendaTimeline({
  appointments,
  recurringReservations,
  barbers,
  workingHours,
  daysOff,
  blockedTimes,
  selectedAgendaDate,
  selectedBarberFilter,
  userRole,
  currentUser,
  formatTime,
  getAppointmentPrice,
  onSelectAgendaAppt,
  onOpenWalkInModal,
  onOpenCheckoutModal,
  onToggleBlockSlot,
}: AgendaTimelineProps) {
  const agendaBarbers = barbers.filter(b => {
    if (userRole === 'barber') return b.id === currentUser?.id
    if (selectedBarberFilter === 'all') return true
    return b.id === selectedBarberFilter
  })

  if (agendaBarbers.length === 0) {
    return (
      <div className="p-12 text-center text-muted-foreground bg-[#121212] border border-white/10 rounded-2xl">
        <User className="w-12 h-12 mx-auto mb-2 opacity-40" />
        <p className="text-sm font-semibold text-white">Nenhum barbeiro ativo encontrado.</p>
      </div>
    )
  }

  const [y, m, d] = selectedAgendaDate.split('-').map(Number)
  const dayOfWeek = new Date(y, m - 1, d).getDay()

  const unpaidAppts = appointments.filter(a => {
    if (getLocalDateStr(a.start_time) !== selectedAgendaDate) return false
    if (a.status === 'completed' || a.status === 'cancelled' || a.status === 'no_show') return false
    const payStatus = Array.isArray(a.payments) ? a.payments[0]?.status : a.payments?.status
    if (payStatus === 'paid') return false
    return true
  })

  return (
    <div className="space-y-6">
      <div className={`grid gap-6 ${agendaBarbers.length > 1 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {agendaBarbers.map((barber) => {
          const isDayOff = daysOff.some(doItem => doItem.barber_id === barber.id && doItem.date === selectedAgendaDate)
          const wh = workingHours.find(w => w.barber_id === barber.id && w.day_of_week === dayOfWeek)
          const isClosed = !wh || wh.is_closed || isDayOff

          let startHour = 8
          let endHour = 19

          if (wh?.slots && Array.isArray(wh.slots) && wh.slots.length > 0) {
            const firstSlot = wh.slots[0]?.start
            const lastSlot = wh.slots[wh.slots.length - 1]?.end
            if (firstSlot) startHour = parseInt(firstSlot.split(':')[0], 10)
            if (lastSlot) endHour = parseInt(lastSlot.split(':')[0], 10)
          }

          const timeSlots: string[] = []
          for (let h = startHour; h < endHour; h++) {
            timeSlots.push(`${String(h).padStart(2, '0')}:00`)
          }

          const lunchStartSlot = wh?.lunch_break_start ? String(wh.lunch_break_start).substring(0, 5) : null

          const extraAppts = appointments.filter(a =>
            a.barber_id === barber.id &&
            a.is_extra === true &&
            getLocalDateStr(a.start_time) === selectedAgendaDate &&
            a.status !== 'cancelled'
          )

          return (
            <div
              key={barber.id}
              className="bg-[#0e0e10] border border-white/10 rounded-3xl p-5 shadow-2xl space-y-4"
            >
              {/* Barber Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full border border-primary/40 overflow-hidden shrink-0 shadow-md">
                    {barber.photo_url ? (
                      <img src={barber.photo_url} alt={barber.full_name} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <div className="w-full h-full bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold text-base">
                        {barber.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white">{barber.full_name}</h4>
                    <p className="text-[11px] text-zinc-400">
                      {isClosed ? '🚪 Fechado neste dia' : `Horário: ${String(startHour).padStart(2, '0')}:00 às ${String(endHour).padStart(2, '0')}:00`}
                    </p>
                  </div>
                </div>
                {isClosed && (
                  <span className="text-[10px] uppercase font-black px-3 py-1 rounded-full bg-destructive/15 text-destructive border border-destructive/30">
                    Fechado / Folga
                  </span>
                )}
              </div>

              {/* Slots list */}
              {isClosed ? (
                <div className="p-8 text-center bg-[#141416] rounded-2xl border border-white/5 text-zinc-400">
                  <Coffee className="w-8 h-8 mx-auto mb-2 opacity-40 text-amber-400" />
                  <p className="text-xs font-bold text-white">Dia Sem Atendimento</p>
                  <p className="text-[11px] text-zinc-400 mt-1">Este profissional não trabalha neste dia da semana.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {timeSlots.map((slotStr) => {
                    const isLunch = lunchStartSlot === slotStr

                    if (isLunch) {
                      return (
                        <div
                          key={slotStr}
                          className="bg-[#18181b] border border-white/5 rounded-2xl p-4 flex items-center justify-between opacity-85 transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <span className="text-2xl font-bold font-mono text-zinc-400 tracking-tight w-16">{slotStr}</span>
                            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm tracking-wide uppercase">
                              <Coffee className="w-4 h-4 text-amber-400" />
                              <span>INTERVALO DE ALMOÇO</span>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Indisponível</span>
                        </div>
                      )
                    }

                    const slotHour = slotStr.substring(0, 2)
                    const appt = appointments.find(a => {
                      if (a.barber_id !== barber.id) return false
                      if (getLocalDateStr(a.start_time) !== selectedAgendaDate) return false
                      if (a.status === 'cancelled') return false
                      const aHour = formatTime(a.start_time).substring(0, 2)
                      return aHour === slotHour
                    })

                    const rec = recurringReservations.find(r => {
                      if (r.barber_id !== barber.id) return false
                      if (r.day_of_week !== dayOfWeek) return false
                      const rHour = r.time_slot.substring(0, 2)
                      if (rHour !== slotHour) return false
                      return isRecurringReservationActiveOnDate(r.start_date, r.interval_weeks, selectedAgendaDate)
                    })

                    const slotStartDate = new Date(`${selectedAgendaDate}T${slotStr}:00-03:00`)
                    const slotEndDate = new Date(slotStartDate.getTime() + 60 * 60000)
                    const blocked = blockedTimes.find(bt => {
                      if (bt.barber_id !== barber.id) return false
                      return new Date(bt.start_time) < slotEndDate && new Date(bt.end_time) > slotStartDate
                    })

                    if (appt) {
                      const isPackage = appt.package_subscription_id || appt.services?.name?.toLowerCase().includes('pacote')

                      if (isPackage) {
                        return (
                          <div
                            key={slotStr}
                            onClick={() => onSelectAgendaAppt(appt)}
                            className="bg-gradient-to-r from-[#947629] via-[#b39034] to-[#c7a33b] border border-amber-300/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl shadow-amber-500/10 hover:brightness-105 transition-all cursor-pointer text-zinc-950 group"
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <span className="text-2xl font-black font-mono text-zinc-950 tracking-tight w-16 shrink-0">{slotStr}</span>
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h5 className="font-black text-base text-zinc-950 uppercase tracking-wide truncate">{appt.customerName}</h5>
                                  <span className="font-mono text-xs text-zinc-900 bg-zinc-950/20 px-2 py-0.5 rounded border border-zinc-950/30 font-bold">
                                    {apptShortCode(appt.id)}
                                  </span>
                                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-zinc-950/30 text-zinc-950 border border-zinc-950/40 flex items-center gap-1 shrink-0">
                                    <Scissors className="w-3 h-3 text-zinc-950" />
                                    {appt.barberName?.split(' ')[0] || barber.full_name?.split(' ')[0]}
                                  </span>
                                </div>
                                <p className="text-xs font-extrabold text-zinc-900/90 truncate">
                                  • {appt.services?.name || 'Pacote Mensal'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                              <span className="px-3.5 py-1.5 rounded-xl bg-zinc-950/30 text-zinc-950 border border-zinc-950/40 text-xs font-black uppercase flex items-center gap-1.5 shadow-sm">
                                <CheckCircle2 className="w-4 h-4 text-zinc-950" />
                                {appt.status === 'completed' ? 'CONCLUÍDO' : 'CONFIRMADO'}
                              </span>
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div
                          key={slotStr}
                          onClick={() => onSelectAgendaAppt(appt)}
                          className={`bg-gradient-to-r from-[#06261a] to-[#0a3825] border border-[#10b981]/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg hover:border-[#10b981]/70 transition-all cursor-pointer group ${
                            appt.status === 'completed'
                              ? 'brightness-110'
                              : appt.status === 'no_show'
                              ? 'from-[#332208] to-[#472f0b] border-amber-500/40'
                              : ''
                          }`}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <span className="text-2xl font-bold font-mono text-[#34d399] tracking-tight w-16 shrink-0">{slotStr}</span>
                            <div className="min-w-0 space-y-0.5">
                              <p className="text-xs text-[#a7f3d0]/80 font-medium">
                                {formatTime(appt.start_time) || slotStr} - {appt.end_time ? formatTime(appt.end_time) : slotStr}
                              </p>
                              <h5 className="font-bold text-base text-white uppercase flex items-center gap-2 flex-wrap truncate">
                                <User className="w-4 h-4 text-[#34d399] shrink-0" />
                                <span>{appt.customerName}</span>
                                <span className="text-zinc-400 font-normal">• {appt.services?.name}</span>
                                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shrink-0">
                                  <Scissors className="w-3 h-3 text-emerald-400" />
                                  {appt.barberName?.split(' ')[0] || barber.full_name?.split(' ')[0]}
                                </span>
                              </h5>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <span className="px-3.5 py-1.5 rounded-xl bg-[#262010] text-[#e5c158] border border-[#a3832c]/50 text-xs font-extrabold flex items-center gap-1.5 shadow-sm">
                              <CheckCircle2 className="w-4 h-4 text-[#e5c158]" />
                              {appt.status === 'completed' ? 'Concluído' : appt.status === 'no_show' ? 'Não Compareceu' : 'Confirmado'}
                            </span>
                          </div>
                        </div>
                      )
                    }

                    if (rec) {
                      return (
                        <div
                          key={slotStr}
                          className="bg-gradient-to-r from-cyan-950/90 to-slate-900 border border-cyan-500/50 rounded-2xl p-4 flex items-center justify-between gap-3 text-cyan-200 shadow-md"
                        >
                          <div className="flex items-center gap-4">
                            <span className="text-2xl font-bold font-mono text-cyan-400 tracking-tight w-16">{slotStr}</span>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white text-base block">{rec.customer_display_name}</span>
                                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-cyan-500/25 text-cyan-200 border border-cyan-500/40 flex items-center gap-1 shrink-0">
                                  <Scissors className="w-3 h-3 text-cyan-300" />
                                  {rec.barber_name?.split(' ')[0] || barber.full_name?.split(' ')[0]}
                                </span>
                              </div>
                              <span className="text-xs text-cyan-300 font-semibold flex items-center gap-1.5">
                                <Repeat className="w-3.5 h-3.5" /> Reserva Fixa ({rec.interval_weeks === 1 ? 'Semanal' : 'Quinzenal'})
                              </span>
                            </div>
                          </div>
                          <span className="px-3 py-1 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold uppercase">
                            ✔ Reservado
                          </span>
                        </div>
                      )
                    }

                    if (blocked) {
                      return (
                        <div
                          key={slotStr}
                          className="bg-[#1c1010] border border-red-500/30 rounded-2xl p-4 transition-all duration-200 flex items-center justify-between gap-3 shadow-md"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <span className="text-2xl font-bold font-mono text-red-400/80 tracking-tight w-16 shrink-0">{slotStr}</span>
                            <div className="flex items-center gap-2 text-red-300 text-sm font-medium min-w-0">
                              <Lock className="w-4 h-4 text-red-400 shrink-0" />
                              <span className="truncate">Horário Fechado{blocked.reason ? ` — ${blocked.reason}` : ''}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => onToggleBlockSlot(barber.id, slotStr, blocked)}
                            title="Reabrir este horário"
                            className="p-2.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/40 rounded-xl transition-all shadow-sm cursor-pointer active:scale-95 shrink-0"
                          >
                            <Lock className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={slotStr}
                        className="bg-[#121212] hover:bg-[#161616] border border-white/10 hover:border-amber-500/40 rounded-2xl p-4 transition-all duration-200 flex items-center justify-between gap-3 shadow-md group"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <span className="text-2xl font-bold font-mono text-white tracking-tight w-16 shrink-0">{slotStr}</span>
                          <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium group-hover:text-zinc-200 transition-colors">
                            <Calendar className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 transition-colors" />
                            <span>Horário Disponível</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => onToggleBlockSlot(barber.id, slotStr, null)}
                            title="Fechar este horário (bloquear para agendamentos)"
                            className="p-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl transition-all shadow-sm cursor-pointer active:scale-95"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenWalkInModal(barber.id, slotStr)}
                            className="px-4 py-2 bg-[#262010] hover:bg-[#382f18] text-[#e5c158] border border-[#a3832c]/50 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer active:scale-95"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Agendar</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Extra Appointments Section */}
              {extraAppts.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="text-[11px] uppercase font-black text-amber-400 tracking-wider">
                      Atendimentos Extra ({extraAppts.length})
                    </span>
                    <div className="flex-1 border-t border-dashed border-amber-500/30" />
                  </div>
                  {extraAppts.map((exAppt) => {
                    const exPayStatus = Array.isArray(exAppt.payments) ? exAppt.payments[0]?.status : exAppt.payments?.status
                    const exIsPaid = exPayStatus === 'confirmed_manually' || exPayStatus === 'paid'
                    return (
                      <div
                        key={exAppt.id}
                        onClick={() => onSelectAgendaAppt(exAppt)}
                        className="bg-gradient-to-r from-[#1a150a] to-[#1c1408] border-2 border-dashed border-amber-500/40 hover:border-amber-500/70 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <span className="text-2xl font-bold font-mono text-amber-400 tracking-tight w-16 shrink-0">
                            {formatTime(exAppt.start_time)}
                          </span>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className="font-bold text-base text-white uppercase truncate">{exAppt.customerName}</h5>
                              <span className="text-[9px] uppercase font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shrink-0">
                                <Zap className="w-3 h-3 text-amber-400" />
                                Extra
                              </span>
                            </div>
                            <p className="text-xs text-amber-200/70 font-medium truncate">
                              {exAppt.services?.name} • R$ {getAppointmentPrice(exAppt).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <span className={`px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase flex items-center gap-1.5 shadow-sm ${
                            exIsPaid
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse'
                          }`}>
                            {exIsPaid ? (
                              <><CheckCircle2 className="w-3.5 h-3.5" /> Pago</>
                            ) : (
                              <><Clock className="w-3.5 h-3.5" /> Pendente</>
                            )}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Checkout do Dia Button */}
      {unpaidAppts.length > 0 && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onOpenCheckoutModal}
            className="w-full py-4 bg-gradient-to-r from-[#6b4f1d] via-[#947629] to-[#6b4f1d] hover:from-[#7a5b22] hover:via-[#a8862f] hover:to-[#7a5b22] text-white border border-amber-400/40 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 transition-all cursor-pointer shadow-xl shadow-amber-900/20 active:scale-[0.98]"
          >
            <DollarSign className="w-5 h-5 text-amber-300" />
            Checkout do Dia — {unpaidAppts.length} pendente{unpaidAppts.length > 1 ? 's' : ''}
            <ChevronRight className="w-4 h-4 text-amber-300" />
          </button>
        </div>
      )}
    </div>
  )
})
