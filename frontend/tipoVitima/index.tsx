import React, { useEffect, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { supabase } from '../../backend/connectors/postgre';
import { getCurrentUser } from '../shared/authSession';
import { cacheReferenceDataV2, executeOfflineSelect, savePendingOccurrence } from '../../backend/offline/offlineV2';
import { useResponsiveLayout } from '../shared/responsive';
import { colors } from '../shared/theme';

type TipoVitimaRow = {
  id: number;
  codigo: string;
  nome: string;
  descricao: string | null;
};

type UserLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
};

type ProtocolSummary = {
  protocolo: string;
  solicitante: string;
  localizacao: string;
  ocorrenciaId: string | null;
  tipoVitimaId: number;
};

export default function TipoVitima({ route, navigation }: any) {
  const layout = useResponsiveLayout();
  const {
    tipo_ocorrencia_id,
    codigo,
    title,
    description,
    mode,
    userLocation,
    tutorialId,
    isTreinamento,
    dataOcorrenciaISO,
  } = route?.params || {};

  const [tipos, setTipos] = useState<TipoVitimaRow[]>([]);
  const [selected, setSelected] = useState<TipoVitimaRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [protocolSummary, setProtocolSummary] = useState<ProtocolSummary | null>(null);

  useEffect(() => {
    if (!protocolSummary) return undefined;

    const timeoutId = setTimeout(() => {
      handleContinueTraining();
    }, 3200);

    return () => clearTimeout(timeoutId);
  }, [protocolSummary]);

  useEffect(() => {
    async function carregarTipos() {
      const { data, error } = await supabase
        .from('tipos_vitima')
        .select('id, codigo, nome, descricao')
        .eq('ativo', true)
        .order('ordem', { ascending: true });

      if (error) {
        console.error('[TipoVitima] Erro ao carregar tipos:', error);
        const offlineRows = await executeOfflineSelect<TipoVitimaRow>(
          'SELECT id, codigo, nome, descricao FROM tipos_vitima WHERE ativo = 1 ORDER BY ordem ASC'
        );
        setTipos(offlineRows);
        return;
      }

      setTipos((data || []) as TipoVitimaRow[]);
      await cacheReferenceDataV2({ tiposVitima: data || [] });
    }

    void carregarTipos();
  }, []);

  async function registrarOcorrencia(tipoVitima: TipoVitimaRow) {
    const user = getCurrentUser();
    if (!user) {
      Alert.alert('Login necessário', 'Sua sessão expirou. Faça login novamente.');
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      return null;
    }

    const location = (userLocation || null) as UserLocation | null;
    const dataISO = dataOcorrenciaISO || new Date().toISOString();

    const { data, error } = await supabase
      .from('ocorrencias')
      .insert({
        solicitante_id: user.id,
        tipo_ocorrencia_id,
        tipo_vitima_id: tipoVitima.id,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        precisao_m: location?.accuracy ?? null,
        descricao: description || null,
        origem: 'app_solicitante',
        is_treinamento: false,
        status: 'registrada',
        criada_em: dataISO,
      })
      .select('id, protocolo')
      .single();

    if (error) {
      console.error('[TipoVitima] Erro ao criar ocorrência:', error);
      if (mode === 'real-offline') {
        const pending = {
          id_local: `local-${Date.now()}`,
          solicitante_id: user.id,
          tipo_ocorrencia_id,
          tipo_vitima_id: tipoVitima.id,
          latitude: location?.latitude ?? null,
          longitude: location?.longitude ?? null,
          precisao_m: location?.accuracy ?? null,
          descricao: description || null,
          origem: 'app_solicitante',
          is_treinamento: false,
          status: 'registrada',
          criada_em: dataISO,
        };
        await savePendingOccurrence(pending);
        return {
          id: pending.id_local,
          protocolo: 'OFFLINE',
          solicitante: user.nome || 'Solicitante',
          localizacao: formatLocation(location),
        };
      }
      Alert.alert('Erro', error.message || 'Não foi possível abrir o chamado.');
      return null;
    }

    await supabase.from('ocorrencia_status_historico').insert({
      ocorrencia_id: data.id,
      status: 'registrada',
      observacao: 'Ocorrência aberta pelo app do solicitante.',
      alterado_por: user.id,
    });

    return {
      ...data,
      solicitante: user.nome || 'Solicitante',
      localizacao: formatLocation(location),
    };
  }

  async function handleConfirm() {
    if (!selected) return;

    try {
      setSaving(true);

      let ocorrenciaId: string | null = null;
      let protocolo: string | null = null;
      const isReal = mode === 'real-online' || mode === 'real-offline';

      if (isReal) {
        const created = await registrarOcorrencia(selected);
        if (!created) return;
        ocorrenciaId = created.id;
        protocolo = created.protocolo || null;
        setProtocolSummary({
          protocolo: created.protocolo || '-',
          solicitante: created.solicitante,
          localizacao: created.localizacao,
          ocorrenciaId,
          tipoVitimaId: selected.id,
        });
        return;
      }

      navigation.navigate('TutorialCaso', {
        tutorialId,
        tipoVitimaId: selected.id,
        profile: selected.codigo,
        codigo,
        title,
        mode,
        is_treinamento: mode === 'training' ? true : !!isTreinamento,
        ocorrenciaId,
        protocolo,
      });
    } finally {
      setSaving(false);
    }
  }

  function handleContinueTraining() {
    if (!protocolSummary || !selected) return;

    setProtocolSummary(null);
    navigation.navigate('TutorialCaso', {
      tutorialId,
      tipoVitimaId: protocolSummary.tipoVitimaId,
      profile: selected.codigo,
      codigo,
      title,
      mode,
      is_treinamento: false,
      ocorrenciaId: protocolSummary.ocorrenciaId,
      protocolo: protocolSummary.protocolo,
    });
  }

  return (
    <View
      style={[
        styles.container,
        {
          paddingHorizontal: layout.horizontalPadding,
          maxWidth: layout.maxContentWidth,
          alignSelf: 'center',
          width: '100%',
        },
      ]}
    >
      <Text style={styles.title}>Tipo da Vítima</Text>

      {title && (
        <Text style={styles.subtitle}>
          Caso: <Text style={styles.subtitleHighlight}>{title}</Text>
        </Text>
      )}

      {description && <Text style={styles.subtitleDescription}>{description}</Text>}

      <View style={styles.optionsContainer}>
        {tipos.map((tipo) => (
          <TouchableOpacity
            key={tipo.id}
            style={[styles.optionCard, selected?.id === tipo.id && styles.optionCardSelected]}
            onPress={() => setSelected(tipo)}
          >
            <FontAwesome6
              name={tipo.codigo === 'recem_nascido' ? 'baby' : tipo.codigo === 'crianca' ? 'child' : 'person'}
              size={24}
              color={selected?.id === tipo.id ? colors.primary : colors.secondary}
            />
            <View style={styles.optionTextContainer}>
              <Text style={styles.optionTitle}>{tipo.nome}</Text>
              <Text style={styles.optionSubtitle}>{tipo.descricao || 'Perfil da vítima'}</Text>
            </View>
            {selected?.id === tipo.id && <FontAwesome6 name="check" size={18} color={colors.primary} />}
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.footer, layout.isSmall && styles.footerStacked]}>
        <TouchableOpacity style={styles.footerButton} onPress={() => navigation.goBack()}>
          <FontAwesome6 name="arrow-left" size={16} color={colors.secondary} />
          <Text style={styles.footerButtonText}>Voltar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.footerButtonPrimary, (!selected || saving) && { opacity: 0.5 }]}
          disabled={!selected || saving}
          onPress={handleConfirm}
        >
          <Text style={styles.footerButtonPrimaryText}>{saving ? 'Abrindo chamado...' : 'Confirmar seleção'}</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={!!protocolSummary}
        transparent
        animationType="fade"
        onRequestClose={handleContinueTraining}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.protocolModal}>
            <View style={styles.modalIcon}>
              <FontAwesome6 name="check" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.modalEyebrow}>Chamado registrado</Text>
            <Text style={styles.modalTitle}>Protocolo enviado ao CIODES</Text>

            <View style={styles.protocolInfoList}>
              <View style={styles.protocolInfoRow}>
                <Text style={styles.protocolInfoLabel}>Protocolo</Text>
                <Text style={styles.protocolInfoValue}>{protocolSummary?.protocolo}</Text>
              </View>
              <View style={styles.protocolInfoRow}>
                <Text style={styles.protocolInfoLabel}>Solicitante</Text>
                <Text style={styles.protocolInfoValue}>{protocolSummary?.solicitante}</Text>
              </View>
              <View style={styles.protocolInfoRowLast}>
                <Text style={styles.protocolInfoLabel}>Localização</Text>
                <Text style={styles.protocolInfoValue}>{protocolSummary?.localizacao}</Text>
              </View>
            </View>
            <Text style={styles.modalAutoText}>Abrindo orientações de treinamento...</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function formatLocation(location: UserLocation | null) {
  if (!location || location.latitude == null || location.longitude == null) {
    return 'Localização não informada';
  }

  const latitude = Number(location.latitude).toFixed(6);
  const longitude = Number(location.longitude).toFixed(6);
  return `${latitude}, ${longitude}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 36,
    paddingHorizontal: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.secondary,
  },
  subtitleHighlight: {
    color: colors.text,
    fontWeight: '600',
  },
  subtitleDescription: {
    fontSize: 14,
    color: colors.secondary,
    marginTop: 4,
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: colors.radiusLg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  optionTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  optionSubtitle: {
    fontSize: 13,
    color: colors.secondary,
    marginTop: 2,
  },
  footer: {
    marginTop: 'auto',
    marginBottom: 40,
    gap: 12,
  },
  footerStacked: {
    marginBottom: 24,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
  },
  footerButtonText: {
    color: colors.secondary,
    fontSize: 16,
  },
  footerButtonPrimary: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: colors.radiusSm,
    alignItems: 'center',
  },
  footerButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  protocolModal: {
    width: '100%',
    maxWidth: 420,
    borderRadius: colors.radiusLg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 20,
  },
  modalIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginBottom: 14,
  },
  modalEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
  },
  protocolInfoList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: colors.radiusMd,
    overflow: 'hidden',
    marginBottom: 18,
  },
  protocolInfoRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardAlt,
  },
  protocolInfoRowLast: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.cardAlt,
  },
  protocolInfoLabel: {
    color: colors.placeholder,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 3,
  },
  protocolInfoValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  modalAutoText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
});





