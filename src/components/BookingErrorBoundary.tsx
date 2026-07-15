'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class BookingErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("=== BOOKING FLOW RUNTIME CRASH DETECTED ===")
    console.error("Error Message:", error.message)
    console.error("Component Stack:", errorInfo.componentStack)
    this.setState({ errorInfo })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-lg text-center space-y-4 my-2">
          <div className="flex items-center justify-center gap-2 text-destructive font-semibold text-sm">
            <AlertCircle className="w-5 h-5" />
            <span>Erro de renderização no agendamento</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
            Ocorreu uma falha ao atualizar os elementos visuais nesta etapa. Por favor, recarregue a página ou tente novamente.
          </p>
          
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <div className="text-[10px] text-left text-rose-400 bg-secondary/80 p-4 rounded border border-border/60 overflow-x-auto max-h-48 font-mono space-y-2">
              <div className="font-bold">{this.state.error.toString()}</div>
              <div className="whitespace-pre">{this.state.errorInfo?.componentStack}</div>
            </div>
          )}

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Recarregar Página
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
