import { RelatorioContext } from './relatorioTypes';
import { escapeHtml, formatDateTime } from './relatorioUtils';

export function buildRelatorioHtml(context: RelatorioContext) {
  const { formData, ocorrencia, relatos, triageInfo, addressText, gps, profissional } = context;
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const relatosHtml = relatos.length
    ? relatos.map((relato) => `
        <tr>
          <td>${escapeHtml(formatDateTime(relato.criado_em))}</td>
          <td>${escapeHtml(relato.socorrista?.nome || 'Socorrista')}</td>
          <td>${escapeHtml(relato.texto)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="3">Nenhum relato anterior registrado.</td></tr>';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>Relatorio APH - ${escapeHtml(ocorrencia?.protocolo || 'N/A')}</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, sans-serif; color: #111827; background: #fff; font-size: 11px; }
        .page { width: 210mm; min-height: 297mm; padding: 12mm; margin: 0 auto; }
        .severity { background: ${triageInfo.color}; color: #fff; padding: 10px 14px; text-align: center; font-weight: 700; text-transform: uppercase; }
        .severity small { display: block; margin-top: 3px; font-weight: 400; text-transform: none; }
        .header { display: flex; justify-content: space-between; gap: 16px; padding: 14px 0; border-bottom: 2px solid #111827; }
        .title { font-size: 18px; font-weight: 800; margin-bottom: 4px; }
        .subtitle { font-size: 11px; color: #374151; }
        .protocol { text-align: right; font-size: 11px; line-height: 1.5; }
        .section { margin-top: 12px; page-break-inside: avoid; }
        .section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; border-bottom: 1px solid #111827; padding-bottom: 4px; margin-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; }
        td, th { border: 1px solid #9CA3AF; padding: 5px 6px; vertical-align: top; }
        th { background: #F3F4F6; text-align: left; font-weight: 800; }
        .label { width: 24%; font-weight: 800; background: #F9FAFB; }
        .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .box { border: 1px solid #9CA3AF; padding: 7px; min-height: 34px; white-space: pre-wrap; }
        .muted { color: #6B7280; }
        .signatures { display: flex; justify-content: center; gap: 24px; margin-top: 104px; padding-top: 12px; }
        .signature { width: 155px; border-top: 1px solid #111827; text-align: center; padding-top: 6px; }
        .footer { margin-top: 18px; padding-top: 8px; border-top: 1px solid #D1D5DB; display: flex; justify-content: space-between; font-size: 9px; color: #4B5563; }
      </style>
    </head>
    <body>
      <main class="page">
        <div class="severity">
          ${escapeHtml(triageInfo.label)}
          <small>${escapeHtml(triageInfo.tempo)}</small>
        </div>

        <header class="header">
          <div>
            <div class="title">Relatorio de Atendimento Pre-Hospitalar</div>
            <div class="subtitle">PROJETI - Sistema de APH</div>
          </div>
          <div class="protocol">
            <strong>Protocolo:</strong> #${escapeHtml(ocorrencia?.protocolo || 'N/A')}<br />
            <strong>Gerado em:</strong> ${dateStr} as ${timeStr}<br />
            <strong>Status:</strong> ${escapeHtml(ocorrencia?.status || 'N/A')}
          </div>
        </header>

        <section class="section">
          <div class="section-title">1. Identificacao</div>
          <table>
            <tr><td class="label">Ocorrencia aberta em</td><td>${escapeHtml(formatDateTime(ocorrencia?.criada_em))}</td><td class="label">Profissional</td><td>${escapeHtml(profissional)}</td></tr>
            <tr><td class="label">Tipo de ocorrencia</td><td>${escapeHtml(ocorrencia?.tipo_ocorrencia?.nome || 'Nao especificado')}</td><td class="label">Tipo de vitima</td><td>${escapeHtml(ocorrencia?.tipo_vitima?.nome || 'Nao informado')}</td></tr>
            <tr><td class="label">Solicitante</td><td>${escapeHtml(ocorrencia?.solicitante?.nome || 'Nao informado')}</td><td class="label">Telefone</td><td>${escapeHtml(ocorrencia?.solicitante?.telefone || 'Nao informado')}</td></tr>
            <tr><td class="label">Endereco</td><td colspan="3">${escapeHtml(addressText)}</td></tr>
            <tr><td class="label">GPS</td><td colspan="3">${escapeHtml(gps)}</td></tr>
          </table>
        </section>

        <section class="section">
          <div class="section-title">2. Dados da vitima</div>
          <table>
            <tr><td class="label">Nome/identificacao</td><td>${escapeHtml(formData.nomeVitima || 'Nao informado')}</td><td class="label">Idade</td><td>${escapeHtml(formData.idadeVitima || 'N/A')}</td></tr>
            <tr><td class="label">Sexo</td><td>${escapeHtml(formData.sexoVitima || 'N/A')}</td><td class="label">Documento</td><td>${escapeHtml(formData.documentoVitima || 'N/A')}</td></tr>
            <tr><td class="label">Contato emergencia</td><td>${escapeHtml(formData.contatoEmergencia || 'N/A')}</td><td class="label">Queixa principal</td><td>${escapeHtml(formData.queixaPrincipal || 'N/A')}</td></tr>
            <tr><td class="label">Alergias</td><td>${escapeHtml(formData.alergias || 'Nao informado')}</td><td class="label">Medicamentos</td><td>${escapeHtml(formData.medicamentos || 'Nao informado')}</td></tr>
            <tr><td class="label">Historico clinico</td><td colspan="3">${escapeHtml(formData.historicoClinico || 'Nao informado')}</td></tr>
          </table>
        </section>

        <section class="section">
          <div class="section-title">3. Avaliacao clinica</div>
          <div class="two">
            <table>
              <tr><th colspan="2">Sinais vitais (${escapeHtml(formData.horarioSinais || 'horario nao informado')})</th></tr>
              <tr><td class="label">PA</td><td>${escapeHtml(formData.pa || '-')} mmHg</td></tr>
              <tr><td class="label">FC</td><td>${escapeHtml(formData.fc || '-')} bpm</td></tr>
              <tr><td class="label">FR</td><td>${escapeHtml(formData.fr || '-')} irpm</td></tr>
              <tr><td class="label">SpO2</td><td>${escapeHtml(formData.spo2 || '-')}%</td></tr>
              <tr><td class="label">Temperatura</td><td>${escapeHtml(formData.temperatura || '-')} C</td></tr>
              <tr><td class="label">Glicemia</td><td>${escapeHtml(formData.glicemia || '-')} mg/dL</td></tr>
              <tr><td class="label">Dor</td><td>${escapeHtml(formData.dor || '-')} / 10</td></tr>
              <tr><td class="label">Consciencia</td><td>${escapeHtml(formData.consciencia || '-')}</td></tr>
            </table>
            <div>
              <strong>Sintomas observados</strong>
              <div class="box">${escapeHtml(formData.sintomas.join(' - ') || 'Nenhum sintoma especifico marcado')}</div>
              <br />
              <strong>ABCDE</strong>
              <div class="box">${escapeHtml(formData.abcde.join(' - ') || 'Sem marcacoes registradas')}</div>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="section-title">4. Condutas e evolucao</div>
          <table>
            <tr><td class="label">Condutas marcadas</td><td>${escapeHtml(formData.condutas.join(' - ') || 'Nenhuma conduta marcada')}</td></tr>
            <tr><td class="label">Descricao da conduta</td><td>${escapeHtml(formData.conduta || 'Nenhuma descricao registrada')}</td></tr>
            <tr><td class="label">Destino/finalizacao</td><td>${escapeHtml(formData.destino || 'Nao informado')}</td></tr>
          </table>
        </section>

        <section class="section">
          <div class="section-title">5. Historico de relatos</div>
          <table>
            <tr><th>Horario</th><th>Socorrista</th><th>Relato</th></tr>
            ${relatosHtml}
          </table>
        </section>

        <section class="section">
          <div class="signatures">
            <div class="signature">${escapeHtml(profissional)}<br /><span class="muted">Socorrista responsavel</span></div>
            <div class="signature">Responsavel pela vitima<br /><span class="muted">Assinatura opcional</span></div>
            <div class="signature">Recebedor no destino<br /><span class="muted">Assinatura/recebimento</span></div>
          </div>
        </section>

        <footer class="footer">
          <span>Documento gerado automaticamente pelo sistema PROJETI</span>
          <span>Informacao confidencial - atendimento pre-hospitalar</span>
        </footer>
      </main>
    </body>
    </html>
  `;
}
