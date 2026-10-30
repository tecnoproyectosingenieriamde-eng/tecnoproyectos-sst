import React, { useRef, useState, useEffect } from 'react';
import DigitalFormsApp from './digital-forms/App';
import { SignatureCanvas, SignatureCanvasRef } from './components/signature/SignatureCanvas';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { createClient, User } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_TABLE = "registros_interventoria";
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

type AppRole = 'superadmin' | 'admin_sst' | 'inspector' | 'trabajador';

interface Profile {
  id: string;
  nombre: string;
  cedula: string;
  cargo: string;
  rol: AppRole;
  empresa: string;
}

type TabType = 'firma' | 'procedimientos' | 'actas' | 'formatos' | 'formularios_digitales' | 'consulta_formatos' | 'manuales' | 'matrices' | 'objetivos' | 'planes' | 'politicas' | 'programas' | 'campo' | 'admin_consola';

interface DocumentoSST {
  id: number;
  codigo: string;
  titulo: string;
  tipo: 'procedimiento' | 'formato' | 'acta' | 'manual' | 'matriz' | 'objetivo' | 'plan' | 'politica' | 'programa';
  version: string;
  extension: string;
  url_archivo: string;
}

interface SavedFormRecord {
  id: string;
  created_at: string;
  created_by: string;
  codigo_formato: string;
  titulo_formato: string;
  datos_formulario: Record<string, unknown>;
  firmas: { nombre?: string; cedula?: string; cargo?: string; firmado_en?: string };
  pdf_path: string;
  estado: string;
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteOtp, setInviteOtp] = useState('');
  const [isInviteOtpMode, setIsInviteOtpMode] = useState(false);
  const [isVerifyingInvite, setIsVerifyingInvite] = useState(false);
  const [inviteOtpError, setInviteOtpError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isPasswordSetupRequired, setIsPasswordSetupRequired] = useState(() => {
    if (typeof window === 'undefined') return false;
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const queryParams = new URLSearchParams(window.location.search);
    return hashParams.get('type') === 'invite' || queryParams.get('type') === 'invite';
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordSetupError, setPasswordSetupError] = useState<string | null>(null);
  const [passwordSetupSuccess, setPasswordSetupSuccess] = useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>('formatos');

  const signatureRef = useRef<SignatureCanvasRef>(null);
  const formSignatureRef = useRef<SignatureCanvasRef>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const formPdfCanvasRef = useRef<HTMLCanvasElement>(null);

  const [signerName, setSignerName] = useState('');
  const [signerDoc, setSignerDoc] = useState('');
  const [signerRole, setSignerRole] = useState('');

  const [documentos, setDocumentos] = useState<DocumentoSST[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(false);
  const [selectedFormat, setSelectedFormat] = useState<DocumentoSST | null>(null);

  const [formPosX, setFormPosX] = useState<number>(50);
  const [formPosY, setFormPosY] = useState<number>(85);
  const [formScale, setFormScale] = useState<number>(180);

  const [formPdfBytes, setFormPdfBytes] = useState<Uint8Array | ArrayBuffer | null>(null);
  const [formPdfDocJs, setFormPdfDocJs] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [formSignatureImage, setFormSignatureImage] = useState<string | null>(null);
  const [isFormProcessing, setIsFormProcessing] = useState<boolean>(false);
  const [signedFormUrl, setSignedFormUrl] = useState<string | null>(null);
  const [archiveStatus, setArchiveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [savedForms, setSavedForms] = useState<SavedFormRecord[]>([]);
  const [isLoadingSavedForms, setIsLoadingSavedForms] = useState(false);
  const [savedFormsError, setSavedFormsError] = useState<string | null>(null);
  const [previewSavedForm, setPreviewSavedForm] = useState<{ url: string; title: string } | null>(null);
  const [previewingSavedFormId, setPreviewingSavedFormId] = useState<string | null>(null);

  const [f14Fecha, setF14Fecha] = useState(new Date().toISOString().split('T')[0]);
  const [f14Lugar, setF14Lugar] = useState('Oficina Cantagallo / Frente de Obra');
  const [f14Responsable, setF14Responsable] = useState('Coordinador SST');
  const [f14Tema, setF14Tema] = useState('Socialización de funciones y trámite de recepción');
  const [f14Facilitador, setF14Facilitador] = useState('Matilde Chamorro Simanca');
  const [f14CargoFacilitador, setF14CargoFacilitador] = useState('Especialista SST');

  const [indFecha, setIndFecha] = useState(new Date().toISOString().split('T')[0]);
  const [indHora, setIndHora] = useState('08:00');
  const [indCapacitador, setIndCapacitador] = useState('Matilde Chamorro Simanca');

  const [f16Fecha, setF16Fecha] = useState(new Date().toISOString().split('T')[0]);
  const [f16Aprobo, setF16Aprobo] = useState('APROBÓ');

  const [f32Area, setF32Area] = useState('Operaciones / Redes Eléctricas');
  const [f45Fecha, setF45Fecha] = useState(new Date().toISOString().split('T')[0]);
  const [f45HoraInicio, setF45HoraInicio] = useState('07:30');
  const [f45Lugar, setF45Lugar] = useState('Poste N° 45 - Cantagallo');
  const [f45Orden, setF45Orden] = useState('OT-2026-089');
  const [f45Actividad, setF45Actividad] = useState('Mantenimiento en red de media tensión');
  const [f45Altura, setF45Altura] = useState('8.5');

  const [escId, setEscId] = useState('ESC-DIEL-01');
  const [escMarca, setEscMarca] = useState('Cuprum Dieléctrica');
  const [escUbicacion, setEscUbicacion] = useState('Cantagallo');
  const [escFecha, setEscFecha] = useState(new Date().toISOString().split('T')[0]);
  const [escResultado, setEscResultado] = useState('APTA PARA USO');

  const [eppLugar, setEppLugar] = useState('Frente de Obra');
  const [eppResultado, setEppResultado] = useState('EPP APTOS PARA USO');

  const [campoIdPoste, setCampoIdPoste] = useState('');
  const [campoTipoLuminaria, setCampoTipoLuminaria] = useState('LED');
  const [campoVatiaje, setCampoVatiaje] = useState('100W');
  const [campoLecturaLux, setCampoLecturaLux] = useState('');
  const [campoEvaluacionLux, setCampoEvaluacionLux] = useState('CONFORME');
  const [campoTipoActividad, setCampoTipoActividad] = useState('INSPECCIÓN PREVENTIVA');
  const [campoEstadoIncidencia, setCampoEstadoIncidencia] = useState('OPERATIVA');
  const [campoSectorBarrio, setCampoSectorBarrio] = useState('');
  const [campoDescripcionTrabajo, setCampoDescripcionTrabajo] = useState('');
  const [campoGPS, setCampoGPS] = useState<{ lat: number; lng: number } | null>(null);
  const [campoGpsStatus, setCampoGpsStatus] = useState('GPS no capturado');
  const [campoFotoFile, setCampoFotoFile] = useState<File | null>(null);
  const [campoSaving, setCampoSaving] = useState(false);
  
  const [datosCache, setDatosCache] = useState<any[]>([]);
  const [datosFiltrados, setDatosFiltrados] = useState<any[]>([]);
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroActividad, setFiltroActividad] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [cuadrillasAbierto, setCuadrillasAbierto] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const adminMapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const adminMapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const adminMarkersLayerRef = useRef<any>(null);

  const [modalFotoUrl, setModalFotoUrl] = useState<string | null>(null);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfDocJs, setPdfDocJs] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [posXPercent, setPosXPercent] = useState<number>(20);
  const [posYPercent, setPosYPercent] = useState<number>(75);
  const [sigScale, setSigScale] = useState<number>(180);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [signedDocumentUrl, setSignedDocumentUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      }
      setAuthLoading(false);
    };
    checkSession();
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const queryParams = new URLSearchParams(window.location.search);
      if (hashParams.get('type') === 'invite' || queryParams.get('type') === 'invite') {
        setIsPasswordSetupRequired(true);
      }
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      setAuthLoading(false);
    });
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (!error && data) {
      setProfile(data as Profile);
      setSignerName(data.nombre);
      setSignerDoc(data.cedula);
      setSignerRole(data.cargo);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoginError(null);
    setAuthLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setLoginError('Credenciales inválidas. Por favor verifique su correo y contraseña.');
    } else if (data.user) {
      setUser(data.user);
      await fetchProfile(data.user.id);
    }
    setAuthLoading(false);
  };

  const handleVerifyInviteOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const normalizedEmail = email.trim().toLowerCase();
    const token = inviteOtp.replace(/\s/g, '');
    if (!normalizedEmail || !/^\d{6,8}$/.test(token)) {
      setInviteOtpError('Ingrese el correo de invitación y el código recibido.');
      return;
    }
    setInviteOtpError(null);
    setIsVerifyingInvite(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token,
        type: 'invite',
      });
      if (error) throw error;
      if (!data.user || !data.session) {
        throw new Error('Supabase no confirmó la invitación. Solicite una nueva invitación al superadministrador.');
      }
      setUser(data.user);
      await fetchProfile(data.user.id);
      setIsPasswordSetupRequired(true);
      setInviteOtp('');
      setIsInviteOtpMode(false);
    } catch (error: any) {
      setInviteOtpError(error?.message || 'No fue posible verificar el código. Compruebe que sea correcto y que no haya vencido.');
    } finally {
      setIsVerifyingInvite(false);
    }
  };

  const handleSetInitialPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setPasswordSetupError(null);
    setPasswordSetupSuccess(null);
    if (newPassword.length < 8) {
      setPasswordSetupError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordSetupError('Las contraseñas no coinciden.');
      return;
    }
    setIsSavingPassword(true);
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordSetupError(error.message || 'No fue posible guardar la contraseña. Inténtelo nuevamente.');
      setIsSavingPassword(false);
      return;
    }
    if (data.user) setUser(data.user);
    setPasswordSetupSuccess('Contraseña creada correctamente. Ya puede utilizar su correo y esta contraseña para ingresar.');
    setNewPassword('');
    setConfirmNewPassword('');
    window.history.replaceState({}, document.title, window.location.pathname);
    setIsSavingPassword(false);
  };

  const handleSendPreviewInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || profile?.rol !== 'superadmin') return;
    // La función de Supabase valida el origen permitido (CORS) y vuelve a comprobar
    // en el servidor que quien invita tenga el rol superadmin. No fijar aquí una URL
    // de deployment concreta: cada Preview de Vercel puede tener un dominio distinto.
    setInviteMessage(null);
    setInviteError(null);
    setIsSendingInvite(true);
    try {
      const { data, error } = await supabase.functions.invoke('sst-preview-invite', {
        body: { email: inviteEmail.trim() },
      });
      if (error) {
        let detail = error.message || 'No fue posible enviar la invitación.';
        try {
          const response = (error as any).context;
          if (response && typeof response.json === 'function') {
            const payload = await response.json();
            if (payload?.error) detail = payload.error;
          }
        } catch {
          // Keep the SDK error when the response body is not JSON.
        }
        throw new Error(detail);
      }
      if (!data?.ok || !data?.invited) {
        throw new Error(data?.error || 'Supabase no confirmó el envío de la invitación.');
      }
      setInviteMessage(`Invitación enviada a ${data.email}. Redirección confirmada: ${data.redirect || 'Preview'}.`);
    } catch (error: any) {
      setInviteError(error?.message || 'Error inesperado al enviar la invitación.');
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
    }
  };

  useEffect(() => {
    if (supabase && user) {
      const fetchDocs = async () => {
        setIsLoadingDocs(true);
        const { data, error } = await supabase
          .from('documentos_sst')
          .select('*')
          .order('codigo', { ascending: true });
        if (!error && data) {
          setDocumentos(data as DocumentoSST[]);
        }
        setIsLoadingDocs(false);
      };
      fetchDocs();
      cargarRegistrosCliente();
    }
  }, [user]);

  const cargarRegistrosCliente = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from(SUPABASE_TABLE).select('*').order('id', { ascending: false });
      if (error) throw error;
      if (data) {
        setDatosCache(data);
        setDatosFiltrados(data);
      }
    } catch (err: any) {
      console.error("Fallo al cargar registros:", err.message);
    }
  };

  // El archivo de formatos diligenciados solo se consulta desde la pestaña superadmin.
  const handleLoadSavedForms = async () => {
    if (!supabase || !user || profile?.rol !== 'superadmin') return;
    setIsLoadingSavedForms(true);
    setSavedFormsError(null);
    try {
      const { data, error } = await supabase
        .from('registros_formularios_sst')
        .select('id, created_at, created_by, codigo_formato, titulo_formato, datos_formulario, firmas, pdf_path, estado')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSavedForms((data || []) as SavedFormRecord[]);
    } catch (err: any) {
      setSavedFormsError(err?.message || 'No fue posible consultar el archivo de formatos.');
      setSavedForms([]);
    } finally {
      setIsLoadingSavedForms(false);
    }
  };

  const handlePreviewSavedForm = async (record: SavedFormRecord) => {
    if (!supabase || profile?.rol !== 'superadmin') {
      alert('No tienes permisos para visualizar estos documentos.');
      return;
    }
    setPreviewingSavedFormId(record.id);
    try {
      // URL temporal sin opción de descarga forzada: el navegador muestra el PDF en línea.
      const { data, error } = await supabase.storage
        .from('sst-formularios-pdf')
        .createSignedUrl(record.pdf_path, 300);
      if (error || !data?.signedUrl) throw error || new Error('No se pudo generar la vista previa privada.');
      setPreviewSavedForm({
        url: data.signedUrl,
        title: `${record.codigo_formato} — ${record.titulo_formato}`
      });
    } catch (err: any) {
      alert(`No fue posible visualizar el PDF: ${err?.message || err}`);
    } finally {
      setPreviewingSavedFormId(null);
    }
  };

  const handleDownloadSavedForm = async (record: SavedFormRecord) => {
    if (!supabase || profile?.rol !== 'superadmin') {
      alert('No tienes permisos para recuperar estos documentos.');
      return;
    }
    const downloadWindow = window.open('about:blank', '_blank');
    try {
      const { data, error } = await supabase.storage
        .from('sst-formularios-pdf')
        .createSignedUrl(record.pdf_path, 60, { download: `${record.codigo_formato}_${record.id}.pdf` });
      if (error || !data?.signedUrl) throw error || new Error('No se pudo generar el enlace privado.');
      if (downloadWindow) {
        downloadWindow.location.href = data.signedUrl;
      } else {
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
      }
    } catch (err: any) {
      if (downloadWindow && !downloadWindow.closed) downloadWindow.close();
      alert(`No fue posible recuperar el PDF: ${err?.message || err}`);
    }
  };

  // Inicialización de mapa de campo con verificación continua de Leaflet
  useEffect(() => {
    if (activeTab === 'campo') {
      const interval = setInterval(() => {
        const L = (window as any).L;
        if (L && mapContainerRef.current) {
          clearInterval(interval);
          initLeafletMap(datosCache);
        }
      }, 200);
      return () => clearInterval(interval);
    }
    if (activeTab === 'admin_consola') {
      const interval = setInterval(() => {
        const L = (window as any).L;
        if (L && adminMapRef.current) {
          clearInterval(interval);
          initAdminMap(datosFiltrados);
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, [activeTab, datosCache, datosFiltrados]);

  const initLeafletMap = (registros: any[] = []) => {
    if (!mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current).setView([6.168, -75.591], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapInstanceRef.current);
      markersLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    }

    mapInstanceRef.current.invalidateSize();
    if (markersLayerRef.current) markersLayerRef.current.clearLayers();

    let bounds: any[] = [];
    registros.forEach(reg => {
      if (reg.latitud && reg.longitud) {
        const latLng = [parseFloat(reg.latitud), parseFloat(reg.longitud)];
        bounds.push(latLng);
        const mapImgId = `map_img_${reg.id}_${Math.random().toString(36).substring(2, 7)}`;
        const popupContent = `
          <div style="font-size: 0.85rem; padding: 4px;">
              <b>Poste:</b> ${reg.id_poste || 'N/D'}<br>
              <b>Actividad:</b> ${reg.tipo_actividad || 'N/D'}<br>
              ${reg.foto_base64 ? `<img id="\${mapImgId}" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" style="width: 120px; height: auto; min-height: 80px; border-radius: 4px; margin-top: 5px; background:#e0e0e0;" alt="Cargando...">` : '<span>Sin evidencia</span>'}
          </div>
        `;
        const marker = L.marker(latLng).addTo(markersLayerRef.current).bindPopup(popupContent);
        if (reg.foto_base64) {
          marker.on('popupopen', () => {
            cargarMiniaturaSegura(reg.foto_base64, mapImgId);
          });
        }
      }
    });

    if (bounds.length > 0 && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  const initAdminMap = (registros: any[] = []) => {
    if (!adminMapRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    if (!adminMapInstanceRef.current) {
      adminMapInstanceRef.current = L.map(adminMapRef.current).setView([6.168, -75.591], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(adminMapInstanceRef.current);
      adminMarkersLayerRef.current = L.layerGroup().addTo(adminMapInstanceRef.current);
    }

    adminMapInstanceRef.current.invalidateSize();
    if (adminMarkersLayerRef.current) adminMarkersLayerRef.current.clearLayers();

    let bounds: any[] = [];
    registros.forEach(reg => {
      if (reg.latitud && reg.longitud) {
        const latLng = [parseFloat(reg.latitud), parseFloat(reg.longitud)];
        bounds.push(latLng);
        const mapImgId = `admin_map_img_${reg.id}_${Math.random().toString(36).substring(2, 7)}`;
        const popupContent = `
          <div style="font-size: 0.85rem; padding: 4px;">
              <b>Poste:</b> ${reg.id_poste || 'N/D'}<br>
              <b>Actividad:</b> ${reg.tipo_actividad || 'N/D'}<br>
              ${reg.foto_base64 ? `<img id="\${mapImgId}" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" style="width: 120px; height: auto; min-height: 80px; border-radius: 4px; margin-top: 5px; background:#e0e0e0;" alt="Cargando...">` : '<span>Sin evidencia</span>'}
          </div>
        `;
        const marker = L.marker(latLng).addTo(adminMarkersLayerRef.current).bindPopup(popupContent);
        if (reg.foto_base64) {
          marker.on('popupopen', () => {
            cargarMiniaturaSegura(reg.foto_base64, mapImgId);
          });
        }
      }
    });

    if (bounds.length > 0 && adminMapInstanceRef.current) {
      adminMapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  const cargarMiniaturaSegura = async (rutaFoto: string, elementoImgId: string) => {
    const el = document.getElementById(elementoImgId) as HTMLImageElement;
    if (!el) return;
    if (rutaFoto.startsWith('data:') || rutaFoto.startsWith('http')) {
      el.src = rutaFoto;
      return;
    }
    const sessionData = await supabase?.auth.getSession();
    const token = sessionData?.data.session?.access_token;
    if (!token) return;
    const rutaLimpia = rutaFoto.startsWith('inspecciones/') ? rutaFoto : `inspecciones/${rutaFoto}`;
    try {
      const res = await fetch(`${supabaseUrl}/storage/v1/object/sign/evidencias-inspeccion/${rutaLimpia}`, {
        method: 'POST',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ expiresIn: 300 })
      });
      const data = await res.json();
      if (res.ok && data.signedURL) {
        el.src = `${supabaseUrl}/storage/v1${data.signedURL}`;
      }
    } catch (e) {
      console.error('Error al solicitar URL firmada:', e);
    }
  };

  useEffect(() => {
    const texto = filtroTexto.toLowerCase();
    const filtrados = datosCache.filter(reg => {
      const matchTexto = 
        (reg.id_poste && reg.id_poste.toLowerCase().includes(texto)) ||
        (reg.sector_barrio && reg.sector_barrio.toLowerCase().includes(texto)) ||
        (reg.usuario && reg.usuario.toLowerCase().includes(texto)) ||
        (reg.descripcion_trabajo && reg.descripcion_trabajo.toLowerCase().includes(texto));
      const matchActividad = filtroActividad === '' || reg.tipo_actividad === filtroActividad;
      
      let matchEstado = true;
      const estReg = reg.estado_incidencia || 'OPERATIVA';
      if (filtroEstado === "PENDIENTE") {
        matchEstado = estReg !== 'OPERATIVA' && estReg !== 'ATENDIDA';
      } else if (filtroEstado === "OPERATIVA") {
        matchEstado = estReg === 'OPERATIVA';
      } else if (filtroEstado === "ATENDIDA") {
        matchEstado = estReg === 'ATENDIDA';
      }
      return matchTexto && matchActividad && matchEstado;
    });
    setDatosFiltrados(filtrados);
  }, [filtroTexto, filtroActividad, filtroEstado, datosCache]);

  const limpiarFiltros = () => {
    setFiltroTexto('');
    setFiltroActividad('');
    setFiltroEstado('');
    setDatosFiltrados([...datosCache]);
  };

  const marcarAtendida = async (idRegistro: number) => {
    if (!confirm("¿Deseas marcar esta incidencia como corregida / atendida?")) return;
    try {
      const sessionData = await supabase?.auth.getSession();
      const token = sessionData?.data.session?.access_token;
      const res = await fetch(`${supabaseUrl}/rest/v1/${SUPABASE_TABLE}?id=eq.${idRegistro}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ estado_incidencia: 'ATENDIDA' })
      });
      if (!res.ok) throw new Error("No se pudo actualizar el registro.");
      alert("Incidencia marcada como atendida correctamente.");
      cargarRegistrosCliente();
    } catch (err: any) {
      alert("Error al actualizar: " + err.message);
    }
  };

  const exportarCSV = () => {
    if (datosFiltrados.length === 0) return alert("No hay datos para exportar.");
    let csvContent = "\uFEFFID Poste,Tipo Actividad,Estado Incidencia,Sector/Barrio,Descripcion,Tecnico,Latitud,Longitud,Fecha,Tiene Evidencia\n";
    datosFiltrados.forEach(r => {
      const tieneFoto = r.foto_base64 ? "SI" : "NO";
      const descripcionLimpia = r.descripcion_trabajo ? r.descripcion_trabajo.replace(/"/g, '""').replace(/\n/g, ' ') : '';
      const fila = [
        `"${r.id_poste || ''}"`,
        `"${r.tipo_actividad || ''}"`,
        `"${r.estado_incidencia || 'OPERATIVA'}"`,
        `"${r.sector_barrio || ''}"`,
        `"${descripcionLimpia}"`,
        `"${r.usuario || ''}"`,
        r.latitud || '',
        r.longitud || '',
        `"${r.timestamp || ''}"`,
        `"${tieneFoto}"`
      ].join(",");
      csvContent += fila + "\n";
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Reporte_Interventoria_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCaptureCampoGPS = () => {
    setCampoGpsStatus('Buscando satélites...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCampoGPS(coords);
        setCampoGpsStatus(`Lat: ${coords.lat.toFixed(5)}, Lon: ${coords.lng.toFixed(5)}`);
      },
      () => {
        alert('Debes permitir el acceso al GPS para capturar la ubicación.');
        setCampoGpsStatus('GPS no capturado');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  };

  const handleSaveCampoRecord = async () => {
    if (!campoIdPoste) return alert('Por favor ingrese el ID del Poste.');
    if (!campoSectorBarrio) return alert('Por favor ingrese el Sector o Barrio.');
    if (!campoDescripcionTrabajo) return alert('Por favor ingrese la Descripción del trabajo.');
    if (!campoGPS) return alert('Por favor capture la coordenada GPS.');
    if (!campoFotoFile) return alert('La fotografía de evidencia es obligatoria.');
    if (!supabase) return alert('Error de conexión con Supabase.');
    try {
      setCampoSaving(true);
      const imageUrl = URL.createObjectURL(campoFotoFile);
      const img = new Image();
      
      img.onload = async () => {
        URL.revokeObjectURL(imageUrl);
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        const MAX_HEIGHT = 1000;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, width, height);
        const altoPanel = 70;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, height - altoPanel, width, altoPanel);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial, sans-serif';
        const fechaActual = new Date().toLocaleString('es-CO');
        ctx.fillText(`POSTE: ${campoIdPoste.toUpperCase()} | FECHA: ${fechaActual}`, 15, height - 42);
        ctx.fillText(`GPS: Lat ${campoGPS.lat.toFixed(5)}, Lon ${campoGPS.lng.toFixed(5)} | TÉCNICO: ${user?.email || signerName}`, 15, height - 17);
        const fotoBase64 = canvas.toDataURL('image/jpeg', 0.8);
        const recordData = {
          id_poste: campoIdPoste.toUpperCase(),
          tipo_luminaria: campoTipoLuminaria,
          vatiaje: campoVatiaje,
          lectura_lux: campoLecturaLux || null,
          evaluacion_lux: campoEvaluacionLux,
          tipo_actividad: campoTipoActividad,
          estado_incidencia: campoEstadoIncidencia,
          sector_barrio: campoSectorBarrio,
          descripcion_trabajo: campoDescripcionTrabajo,
          usuario: user?.email || signerName,
          municipio: 'Cantagallo',
          latitud: campoGPS.lat,
          longitud: campoGPS.lng,
          timestamp: new Date().toISOString(),
          foto_base64: fotoBase64
        };
        const { error } = await supabase.from(SUPABASE_TABLE).insert([recordData]);
        if (error) {
          alert(`Error guardando registro: ${error.message}`);
        } else {
          alert('✅ ¡Inspección de campo guardada exitosamente!');
          setCampoIdPoste('');
          setCampoSectorBarrio('');
          setCampoDescripcionTrabajo('');
          setCampoLecturaLux('');
          setCampoFotoFile(null);
          setCampoGPS(null);
          setCampoGpsStatus('GPS no capturado');
          cargarRegistrosCliente();
        }
        setCampoSaving(false);
      };
      img.onerror = () => {
        URL.revokeObjectURL(imageUrl);
        alert('Error al procesar la fotografía.');
        setCampoSaving(false);
      };
      img.src = imageUrl;
    } catch (err: any) {
      alert(`Error al procesar la inspección: ${err.message || err}`);
      setCampoSaving(false);
    }
  };

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setSignedDocumentUrl(null);
      setSignatureImage(null);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        setPdfBytes(bytes);
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        const loadedPdf = await loadingTask.promise;
        setPdfDocJs(loadedPdf);
        setNumPages(loadedPdf.numPages);
        setSelectedPage(1);
      } catch (err: any) {
        alert(`Error al cargar el archivo PDF: ${err.message || err}`);
      }
    } else {
      alert('Por favor seleccione un archivo PDF válido.');
    }
  };

  useEffect(() => {
    if (!pdfDocJs || !pdfCanvasRef.current) return;
    let isMounted = true;
    pdfDocJs.getPage(selectedPage).then((page: any) => {
      if (!isMounted) return;
      const canvas = pdfCanvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;
      const scale = 1.2;
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      page.render({ canvasContext: context, viewport });
    });
    return () => { isMounted = false; };
  }, [pdfDocJs, selectedPage]);

  useEffect(() => {
    if (!formPdfDocJs || !formPdfCanvasRef.current || !selectedFormat) return;
    let isMounted = true;
    formPdfDocJs.getPage(1).then((page: any) => {
      if (!isMounted) return;
      const canvas = formPdfCanvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;
      const scale = 1.2;
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      page.render({ canvasContext: context, viewport });
    });
    return () => { isMounted = false; };
  }, [formPdfDocJs, selectedFormat]);

  const handleCaptureSignature = () => {
    if (signatureRef.current?.isEmpty()) {
      alert('⚠️ Por favor dibuje su firma en el recuadro antes de confirmar.');
      return;
    }
    const dataUrl = signatureRef.current?.toDataURL();
    if (dataUrl) {
      setSignatureImage(dataUrl);
      if (posYPercent === 0) setPosYPercent(75);
      if (posXPercent === 0) setPosXPercent(20);
    }
  };

  const handleClearSignature = () => {
    signatureRef.current?.clear();
    setSignatureImage(null);
  };

  const handleProcessDocumentSigning = async () => {
    if (!pdfFile || !signatureImage) {
      alert('Por favor asegúrese de haber cargado el PDF y capturado la firma.');
      return;
    }
    try {
      setIsProcessing(true);
      const freshBuffer = await pdfFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(freshBuffer);
      const pages = pdfDoc.getPages();
      const targetPage = pages[selectedPage - 1];
      const { width: pageWidth, height: pageHeight } = targetPage.getSize();
      const sigWidth = Number(sigScale);
      const sigHeight = Number(sigScale) * 0.45;
      
      const realX = (pageWidth * (posXPercent / 100)) - (sigWidth / 2);
      const realY = pageHeight - (pageHeight * (posYPercent / 100)) - (sigHeight / 2);
      
      const base64Data = signatureImage.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const embeddedImage = await pdfDoc.embedPng(bytes);
      targetPage.drawImage(embeddedImage, { 
        x: Math.max(5, Math.min(realX, pageWidth - sigWidth - 5)), 
        y: Math.max(5, Math.min(realY, pageHeight - sigHeight - 5)), 
        width: sigWidth, 
        height: sigHeight 
      });
      
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const auditText = `FIRMADO ELECTRÓNICAMENTE | ${signerName} (C.C. ${signerDoc}) | ${new Date().toLocaleString()}`;
      targetPage.drawText(auditText, { 
        x: Math.max(10, realX), 
        y: Math.max(2, realY - 6), 
        size: 5.5, 
        font, 
        color: rgb(0.3, 0.3, 0.3), 
        opacity: 0.65 
      });
      
      const signedPdfBytes = await pdfDoc.save();
      const blob = new Blob([signedPdfBytes as any], { type: 'application/pdf' });
      setSignedDocumentUrl(URL.createObjectURL(blob));
      setIsProcessing(false);
      alert('¡Documento firmado y sellado exitosamente!');
    } catch (error) {
      alert('Ocurrió un error al estampar la firma en el PDF.');
      setIsProcessing(false);
    }
  };

  const handleSelectFormat = async (doc: DocumentoSST) => {
    setSelectedFormat(doc);
    setSignedFormUrl(null);
    setFormSignatureImage(null);
    try {
      const response = await fetch(doc.url_archivo);
      if (!response.ok) throw new Error(`Error HTTP al descargar: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) throw new Error('El archivo descargado está vacío.');
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      if (doc.codigo === 'FM-SST-14') {
        firstPage.drawText(f14Fecha, { x: 130, y: 730, size: 8, font });
        firstPage.drawText(f14Lugar, { x: 350, y: 730, size: 8, font });
        firstPage.drawText(f14Responsable, { x: 180, y: 710, size: 8, font });
        firstPage.drawText(f14Tema, { x: 130, y: 690, size: 8, font });
        firstPage.drawText(f14Facilitador, { x: 180, y: 150, size: 8, font });
        firstPage.drawText(f14CargoFacilitador, { x: 420, y: 150, size: 8, font });
      } else if (doc.codigo === 'FM-SST-15') {
        firstPage.drawText(indFecha, { x: 100, y: 730, size: 8, font });
        firstPage.drawText(indHora, { x: 240, y: 730, size: 8, font });
        firstPage.drawText(indCapacitador, { x: 400, y: 730, size: 8, font });
        firstPage.drawText(signerName, { x: 130, y: 710, size: 8, font });
        firstPage.drawText(signerDoc, { x: 400, y: 710, size: 8, font });
      } else if (doc.codigo === 'FM-SST-16') {
        firstPage.drawText(signerName, { x: 120, y: 720, size: 8, font });
        firstPage.drawText(signerRole, { x: 380, y: 720, size: 8, font });
        firstPage.drawText(f16Fecha, { x: 120, y: 700, size: 8, font });
        firstPage.drawText(f16Aprobo, { x: 380, y: 700, size: 8, font: boldFont, color: rgb(0.1, 0.4, 0.1) });
      } else if (doc.codigo === 'FM-SST-32') {
        firstPage.drawText(f32Area, { x: 130, y: 720, size: 8, font });
        firstPage.drawText(signerName, { x: 150, y: 700, size: 8, font });
        firstPage.drawText(signerRole, { x: 420, y: 700, size: 8, font });
      } else if (doc.codigo === 'FM-SST-45') {
        firstPage.drawText(f45Fecha, { x: 100, y: 735, size: 8, font });
        firstPage.drawText(f45HoraInicio, { x: 260, y: 735, size: 8, font });
        firstPage.drawText(f45Lugar, { x: 100, y: 715, size: 8, font });
        firstPage.drawText(f45Orden, { x: 400, y: 715, size: 8, font });
        firstPage.drawText(f45Actividad, { x: 100, y: 695, size: 8, font });
        firstPage.drawText(f45Altura, { x: 450, y: 695, size: 8, font });
      } else if (doc.codigo === 'FM-SST-46') {
        firstPage.drawText(escId, { x: 130, y: 715, size: 8, font });
        firstPage.drawText(escMarca, { x: 270, y: 715, size: 8, font });
        firstPage.drawText(escUbicacion, { x: 430, y: 715, size: 8, font });
        firstPage.drawText(escFecha, { x: 430, y: 695, size: 8, font });
        firstPage.drawText(escResultado, { x: 200, y: 150, size: 9, font: boldFont, color: rgb(0.1, 0.4, 0.1) });
      } else if (doc.codigo === 'FM-SST-47') {
        firstPage.drawText(signerName, { x: 150, y: 715, size: 8, font });
        firstPage.drawText(escFecha, { x: 430, y: 715, size: 8, font });
        firstPage.drawText(eppLugar, { x: 430, y: 695, size: 8, font });
        firstPage.drawText(eppResultado, { x: 200, y: 150, size: 9, font: boldFont, color: rgb(0.1, 0.4, 0.1) });
      } else {
        firstPage.drawText(signerName, { x: 150, y: 710, size: 9, font });
        firstPage.drawText(signerDoc, { x: 400, y: 710, size: 9, font });
        firstPage.drawText(new Date().toLocaleDateString(), { x: 150, y: 690, size: 9, font });
      }
      const pdfBytes = await pdfDoc.save();
      setFormPdfBytes(pdfBytes);
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) });
      const loadedPdf = await loadingTask.promise;
      setFormPdfDocJs(loadedPdf);
    } catch (e: any) {
      alert(`Error cargando la plantilla oficial: ${e.message || e}`);
    }
  };

  const handleCaptureFormSignature = () => {
    if (formSignatureRef.current?.isEmpty()) {
      alert('⚠️ Por favor dibuje su firma en el recuadro.');
      return;
    }
    const dataUrl = formSignatureRef.current?.toDataURL();
    if (dataUrl) {
      setFormSignatureImage(dataUrl);
      if (formPosY === 0) setFormPosY(85);
      if (formPosX === 0) setFormPosX(50);
    }
  };
  
  const handleSaveAndSignDynamicForm = async () => {
    if (!formSignatureImage || !selectedFormat) {
      alert('⚠️ Por favor dibuje y confirme su firma en la vista previa antes de registrar el formato.');
      return;
    }
    try {
      setIsFormProcessing(true);
      let bytesToLoad: ArrayBuffer | Uint8Array | null = formPdfBytes;
      if (!bytesToLoad) {
        const res = await fetch(selectedFormat.url_archivo);
        if (!res.ok) throw new Error('No se pudo descargar el archivo de respaldo.');
        bytesToLoad = await res.arrayBuffer();
      }
      const pdfDoc = await PDFDocument.load(bytesToLoad);
      const pages = pdfDoc.getPages();
      const targetPage = pages[0];
      const { width: pageWidth, height: pageHeight } = targetPage.getSize();
      
      const sigWidth = Number(formScale);
      const sigHeight = Number(formScale) * 0.45;
      
      const realX = (pageWidth * (formPosX / 100)) - (sigWidth / 2);
      const realY = pageHeight - (pageHeight * (formPosY / 100)) - (sigHeight / 2);
      const base64Data = formSignatureImage.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const embeddedImage = await pdfDoc.embedPng(bytes);
      targetPage.drawImage(embeddedImage, {
        x: Math.max(5, Math.min(realX, pageWidth - sigWidth - 5)),
        y: Math.max(5, Math.min(realY, pageHeight - sigHeight - 5)),
        width: sigWidth,
        height: sigHeight,
      });
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const timestamp = new Date().toLocaleString();
      const auditText = `FIRMADO SG-SST | ${signerName} (C.C. ${signerDoc}) | ${timestamp}`;
      targetPage.drawText(auditText, {
        x: Math.max(10, realX),
        y: Math.max(2, realY - 6),
        size: 5.5,
        font,
        color: rgb(0.2, 0.2, 0.2),
        opacity: 0.7,
      });
      const signedPdfBytes = await pdfDoc.save();
      const blob = new Blob([signedPdfBytes as any], { type: 'application/pdf' });
      const signedUrl = URL.createObjectURL(blob);
      setSignedFormUrl(signedUrl);
      setArchiveStatus('idle');

      // Descarga y archivo son flujos separados: un fallo de archivo no impide
      // que el operario descargue el PDF ya generado.
      try {
        if (!supabase || !user) throw new Error('No hay una sesión autenticada con Supabase.');
        const archiveId = crypto.randomUUID();
        const pdfPath = `${user.id}/${archiveId}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('sst-formularios-pdf')
          .upload(pdfPath, blob, { contentType: 'application/pdf', upsert: false });
        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase
          .from('registros_formularios_sst')
          .insert({
            id: archiveId,
            created_by: user.id,
            codigo_formato: selectedFormat.codigo,
            titulo_formato: selectedFormat.titulo,
            datos_formulario: { codigo: selectedFormat.codigo, version: selectedFormat.version },
            firmas: {
              nombre: signerName,
              cedula: signerDoc,
              cargo: signerRole,
              firmado_en: new Date().toISOString()
            },
            pdf_path: pdfPath,
            estado: 'completado'
          });
        if (insertError) throw insertError;
        setArchiveStatus('saved');
        alert(`✅ Formato ${selectedFormat.codigo} firmado, archivado y listo para descargar.`);
      } catch (archiveError: any) {
        setArchiveStatus('error');
        console.error('El PDF se generó, pero no se pudo archivar en Supabase:', archiveError);
        alert(`El PDF quedó listo para descargar, pero no se pudo guardar en el archivo privado. Puede descargarlo ahora y reportar este mensaje al administrador. Detalle: ${archiveError?.message || archiveError}`);
      }
      setIsFormProcessing(false);
    } catch (err: any) {
      alert(`Ocurrió un error al procesar el formato: ${err.message || err}`);
      setIsFormProcessing(false);
    }
  };

  const handleArchiveDigitalPdf = async (blob: Blob, codigoFormato: string, tituloFormato: string, datosFormulario: unknown) => {
    if (!supabase || !user) throw new Error('No hay una sesión autenticada con Supabase.');
    const archiveId = crypto.randomUUID();
    const pdfPath = `${user.id}/${archiveId}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('sst-formularios-pdf')
      .upload(pdfPath, blob, { contentType: 'application/pdf', upsert: false });
    if (uploadError) throw uploadError;

    const sanitizeArchiveData = (value: unknown): unknown => {
      if (typeof value === 'string' && value.startsWith('data:image/')) return '[Firma capturada; incluida en el PDF]';
      if (Array.isArray(value)) return value.map(sanitizeArchiveData);
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
          key,
          /firma|signature/i.test(key) ? (item ? '[Firma capturada; incluida en el PDF]' : item) : sanitizeArchiveData(item)
        ]));
      }
      return value;
    };
    const formData = (datosFormulario && typeof datosFormulario === 'object' && !Array.isArray(datosFormulario))
      ? datosFormulario as Record<string, unknown>
      : {};
    // FM-SST-32 identifies the worker inside the form. Keep that person as signer,
    // and preserve the authenticated account separately as the user who registered it.
    const workerName = codigoFormato === 'FM-SST-32' && typeof formData.worker === 'string'
      ? formData.worker.trim()
      : '';
    const workerRole = codigoFormato === 'FM-SST-32' && typeof formData.role === 'string'
      ? formData.role.trim()
      : '';
    const { error: insertError } = await supabase
      .from('registros_formularios_sst')
      .insert({
        id: archiveId,
        created_by: user.id,
        codigo_formato: codigoFormato,
        titulo_formato: tituloFormato,
        datos_formulario: sanitizeArchiveData(datosFormulario) as Record<string, unknown>,
        firmas: {
          nombre: workerName || profile?.nombre || '',
          cedula: codigoFormato === 'FM-SST-32' ? '' : (profile?.cedula || ''),
          cargo: workerRole || profile?.cargo || '',
          registrado_por: profile?.nombre || user.email || user.id,
          firmado_en: new Date().toISOString()
        },
        pdf_path: pdfPath,
        estado: 'completado'
      });
    if (insertError) throw insertError;
  };

  const userRole = profile?.rol || 'trabajador';
  const canAccessFirma = true; 

  const tabToTipoMap: Record<string, string> = {
    formatos: 'formato',
    actas: 'acta',
    procedimientos: 'procedimiento',
    programas: 'programa',
    politicas: 'politica',
    planes: 'plan',
    objetivos: 'objetivo',
    matrices: 'matriz',
    manuales: 'manual'
  };
  const targetTipo = tabToTipoMap[activeTab] || activeTab;
  const filteredDocs = documentos.filter(d => d.tipo === targetTipo);

  if (authLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', fontFamily: 'sans-serif' }}>
        <p style={{ color: '#1e3a8a', fontWeight: 'bold', fontSize: '16px' }}>⏳ Cargando SG-SST Tecnoproyectos...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9', padding: '20px' }}>
        <div style={{ width: '100%', maxWidth: '400px', backgroundColor: '#ffffff', borderRadius: '12px', padding: '30px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', borderTop: '6px solid #1e3a8a' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <img src="https://static.wixstatic.com/media/d0ce54_5945f241b1534afeb1a98e9e645f4482~mv2.jpg" alt="Logo Tecnoproyectos" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #1e3a8a', marginBottom: '10px' }} />
            <h2 style={{ color: '#1e3a8a', margin: '0', fontSize: '20px', fontWeight: 'bold' }}>TECNOPROYECTOS INGENIERÍA</h2>
            <p style={{ color: '#64748b', fontSize: '12px', margin: '5px 0 0 0' }}>Ingreso Seguro al Sistema SG-SST</p>
          </div>
          {loginError && (
            <div style={{ backgroundColor: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '15px' }}>
              {loginError}
            </div>
          )}
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '5px' }}>Correo Electrónico:</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@tecnoproyectos.com" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '5px' }}>Contraseña:</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
            <button type="submit" style={{ width: '100%', backgroundColor: '#1e3a8a', color: '#ffffff', padding: '12px', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
              🔐 Iniciar Sesión
            </button>
          </form>
          <div style={{ marginTop: '18px', borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
            <button type="button" onClick={() => { setIsInviteOtpMode(v => !v); setInviteOtpError(null); }} style={{ width: '100%', background: 'transparent', color: '#1e3a8a', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '9px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              {isInviteOtpMode ? 'Volver al inicio de sesión' : '¿Primera vez? Aceptar invitación con código'}
            </button>
            {isInviteOtpMode && (
              <form onSubmit={handleVerifyInviteOtp} style={{ marginTop: '14px' }}>
                <p style={{ color: '#475569', fontSize: '12px', lineHeight: 1.5 }}>Escriba el correo al que llegó la invitación y el código numérico del mensaje. No abra enlaces de confirmación.</p>
                {inviteOtpError && <div role="alert" style={{ backgroundColor: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '12px' }}>{inviteOtpError}</div>}
                <div style={{ marginBottom: '12px' }}>
                  <label htmlFor="invite-otp-email" style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '5px' }}>Correo de invitación:</label>
                  <input id="invite-otp-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@empresa.com" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label htmlFor="invite-otp-code" style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '5px' }}>Código de invitación:</label>
                  <input id="invite-otp-code" type="text" inputMode="numeric" autoComplete="one-time-code" required maxLength={8} value={inviteOtp} onChange={(e) => setInviteOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))} placeholder="Código recibido por correo" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '16px', letterSpacing: '3px', boxSizing: 'border-box' }} />
                </div>
                <button type="submit" disabled={isVerifyingInvite} style={{ width: '100%', backgroundColor: isVerifyingInvite ? '#64748b' : '#0f766e', color: '#ffffff', padding: '11px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: isVerifyingInvite ? 'wait' : 'pointer' }}>
                  {isVerifyingInvite ? 'Verificando...' : 'Verificar código y continuar'}
                </button>
              </form>
            )}
          </div>
          <p style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', marginTop: '20px' }}>Acceso protegido según Decreto 1072 de 2015</p>
        </div>
      </div>
    );
  }

  if (user && isPasswordSetupRequired) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9', padding: '20px' }}>
        <div style={{ width: '100%', maxWidth: '420px', backgroundColor: '#ffffff', borderRadius: '12px', padding: '30px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', borderTop: '6px solid #1e3a8a' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <img src="https://static.wixstatic.com/media/d0ce54_5945f241b1534afeb1a98e9e645f4482~mv2.jpg" alt="Logo Tecnoproyectos" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #1e3a8a', marginBottom: '10px' }} />
            <h2 style={{ color: '#1e3a8a', margin: '0', fontSize: '20px', fontWeight: 'bold' }}>Crear contraseña</h2>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '8px 0 0 0' }}>Configure su contraseña personal para acceder al sistema SG-SST.</p>
          </div>
          {passwordSetupError && (
            <div role="alert" style={{ backgroundColor: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '15px' }}>
              {passwordSetupError}
            </div>
          )}
          {passwordSetupSuccess && (
            <div role="status" style={{ backgroundColor: '#dcfce7', border: '1px solid #86efac', color: '#166534', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '15px' }}>
              {passwordSetupSuccess}
            </div>
          )}
          {!passwordSetupSuccess && (
          <form onSubmit={handleSetInitialPassword}>
            <div style={{ marginBottom: '15px' }}>
              <label htmlFor="new-sst-password" style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '5px' }}>Nueva contraseña:</label>
              <input id="new-sst-password" type="password" autoComplete="new-password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="confirm-sst-password" style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '5px' }}>Confirmar contraseña:</label>
              <input id="confirm-sst-password" type="password" autoComplete="new-password" required minLength={8} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="Repita la contraseña" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
            <button type="submit" disabled={isSavingPassword} style={{ width: '100%', backgroundColor: isSavingPassword ? '#64748b' : '#1e3a8a', color: '#ffffff', padding: '12px', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', cursor: isSavingPassword ? 'wait' : 'pointer' }}>
              {isSavingPassword ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </form>
          )}
          {passwordSetupSuccess && (
            <button type="button" onClick={() => setIsPasswordSetupRequired(false)} style={{ width: '100%', backgroundColor: '#1e3a8a', color: '#ffffff', padding: '12px', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
              Continuar al sistema
            </button>
          )}
          <p style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', marginTop: '20px' }}>Use esta contraseña junto con su correo electrónico en los próximos ingresos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ padding: '10px', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="card" style={{ borderTop: '5px solid #1e3a8a', backgroundColor: '#ffffff', borderRadius: '12px', padding: '15px 20px', boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <img src="https://static.wixstatic.com/media/d0ce54_5945f241b1534afeb1a98e9e645f4482~mv2.jpg" alt="Logo Tecnoproyectos" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #1e3a8a' }} />
            <div>
              <h1 className="title" style={{ color: '#1e3a8a', margin: 0, fontSize: '18px', fontWeight: 'bold' }}>TECNOPROYECTOS INGENIERÍA S.A.S.</h1>
              <p style={{ color: '#4b5563', fontSize: '12px', margin: '2px 0 0 0' }}>
                👤 {profile?.nombre} | <strong>{profile?.cargo}</strong> ({profile?.rol.toUpperCase()})
              </p>
            </div>
          </div>
          <button onClick={handleLogout} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>🚪 Salir</button>
        </div>

        <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '6px', borderRadius: '8px', flexWrap: 'wrap', marginBottom: '15px' }}>
          {canAccessFirma && (
            <button onClick={() => { setActiveTab('firma'); setSelectedFormat(null); }} style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'firma' ? '#1e3a8a' : 'transparent', color: activeTab === 'firma' ? '#fff' : '#475569', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>✍️ Firma PDF</button>
          )}
          <button onClick={() => { setActiveTab('campo'); setSelectedFormat(null); }} style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'campo' ? '#1e3a8a' : 'transparent', color: activeTab === 'campo' ? '#fff' : '#475569', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>📍 Campo y Mapa</button>
          <button onClick={() => { setActiveTab('politicas'); setSelectedFormat(null); }} style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'politicas' ? '#1e3a8a' : 'transparent', color: activeTab === 'politicas' ? '#fff' : '#475569', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>📜 Políticas</button>
          <button onClick={() => { setActiveTab('procedimientos'); setSelectedFormat(null); }} style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'procedimientos' ? '#1e3a8a' : 'transparent', color: activeTab === 'procedimientos' ? '#fff' : '#475569', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>📋 Procedimientos</button>
          <button onClick={() => { setActiveTab('formatos'); setSelectedFormat(null); }} style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'formatos' ? '#1e3a8a' : 'transparent', color: activeTab === 'formatos' ? '#fff' : '#475569', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>📁 Plantillas en blanco</button>
          <button onClick={() => { setActiveTab('formularios_digitales'); setSelectedFormat(null); }} style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'formularios_digitales' ? '#1e3a8a' : 'transparent', color: activeTab === 'formularios_digitales' ? '#fff' : '#475569', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>📝 Formularios digitales</button>
          {userRole === 'superadmin' && (
            <button onClick={() => { setActiveTab('consulta_formatos'); setSelectedFormat(null); void handleLoadSavedForms(); }} style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'consulta_formatos' ? '#1e3a8a' : 'transparent', color: activeTab === 'consulta_formatos' ? '#fff' : '#475569', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>🗂️ Consulta de formatos</button>
          )}
          
          {(userRole === 'superadmin' || userRole === 'admin_sst') && (
            <>
              <button onClick={() => { setActiveTab('admin_consola'); setSelectedFormat(null); }} style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'admin_consola' ? '#1e3a8a' : 'transparent', color: activeTab === 'admin_consola' ? '#fff' : '#475569', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>📊 Consola Admin</button>
              <button onClick={() => { setActiveTab('manuales'); setSelectedFormat(null); }} style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'manuales' ? '#1e3a8a' : 'transparent', color: activeTab === 'manuales' ? '#fff' : '#475569', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>📖 Manuales</button>
              <button onClick={() => { setActiveTab('matrices'); setSelectedFormat(null); }} style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'matrices' ? '#1e3a8a' : 'transparent', color: activeTab === 'matrices' ? '#fff' : '#475569', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>📊 Matrices</button>
              <button onClick={() => { setActiveTab('objetivos'); setSelectedFormat(null); }} style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'objetivos' ? '#1e3a8a' : 'transparent', color: activeTab === 'objetivos' ? '#fff' : '#475569', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>🎯 Objetivos</button>
              <button onClick={() => { setActiveTab('planes'); setSelectedFormat(null); }} style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'planes' ? '#1e3a8a' : 'transparent', color: activeTab === 'planes' ? '#fff' : '#475569', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>🗺️ Planes</button>
              <button onClick={() => { setActiveTab('programas'); setSelectedFormat(null); }} style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'programas' ? '#1e3a8a' : 'transparent', color: activeTab === 'programas' ? '#fff' : '#475569', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>📌 Programas</button>
              <button onClick={() => { setActiveTab('actas'); setSelectedFormat(null); }} style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'actas' ? '#1e3a8a' : 'transparent', color: activeTab === 'actas' ? '#fff' : '#475569', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>📄 Actas SST</button>
            </>
          )}
        </div>

        {activeTab === 'campo' && (
          <div style={{ padding: '10px 0' }}>
            <h2 style={{ color: '#1e3a8a', fontSize: '16px', marginBottom: '8px' }}>📍 Módulo de Campo: Localización y Luminarias</h2>
            <p style={{ color: '#475569', fontSize: '12px', marginBottom: '15px' }}>Escoja las opciones de inspección, capture el GPS y visualice las coordenadas directamente en el mapa interactivo.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '15px', marginBottom: '15px' }}>
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', padding: '15px', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '13px', color: '#1e3a8a', margin: '0 0 10px 0' }}>📋 Datos del Registro</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>ID Poste:</label>
                    <input type="text" value={campoIdPoste} onChange={(e) => setCampoIdPoste(e.target.value)} placeholder="Ej: PST-1045" style={{ width: '92%', padding: '5px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Tipo Luminaria:</label>
                    <select value={campoTipoLuminaria} onChange={(e) => setCampoTipoLuminaria(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                      <option value="LED">LED</option>
                      <option value="Sodio (SAP)">Sodio (SAP)</option>
                      <option value="Metal Halide">Metal Halide</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Vatiaje:</label>
                    <select value={campoVatiaje} onChange={(e) => setCampoVatiaje(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                      <option value="50W">50W</option>
                      <option value="70W">70W</option>
                      <option value="100W">100W</option>
                      <option value="150W">150W</option>
                      <option value="250W">250W</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Lectura Lux:</label>
                    <input type="text" value={campoLecturaLux} onChange={(e) => setCampoLecturaLux(e.target.value)} placeholder="Ej: 45" style={{ width: '92%', padding: '5px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Evaluación Lux:</label>
                    <select value={campoEvaluacionLux} onChange={(e) => setCampoEvaluacionLux(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                      <option value="CONFORME">CONFORME</option>
                      <option value="NO CONFORME">NO CONFORME</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Estado Operativo:</label>
                    <select value={campoEstadoIncidencia} onChange={(e) => setCampoEstadoIncidencia(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                      <option value="OPERATIVA">OPERATIVA</option>
                      <option value="APAGADA / FALLA">APAGADA / FALLA</option>
                      <option value="MANTENIMIENTO">MANTENIMIENTO</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Tipo Actividad:</label>
                  <select value={campoTipoActividad} onChange={(e) => setCampoTipoActividad(e.target.value)} style={{ width: '96%', padding: '5px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                    <option value="INSPECCIÓN PREVENTIVA">INSPECCIÓN PREVENTIVA</option>
                    <option value="MANTENIMIENTO CORRECTIVO">MANTENIMIENTO CORRECTIVO</option>
                    <option value="REPOSICIÓN DE LUMINARIA">REPOSICIÓN DE LUMINARIA</option>
                  </select>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Sector / Barrio:</label>
                  <input type="text" value={campoSectorBarrio} onChange={(e) => setCampoSectorBarrio(e.target.value)} placeholder="Ej: Cantagallo Centro" style={{ width: '96%', padding: '5px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Descripción del Trabajo:</label>
                  <input type="text" value={campoDescripcionTrabajo} onChange={(e) => setCampoDescripcionTrabajo(e.target.value)} placeholder="Detalle la actividad realizada" style={{ width: '96%', padding: '5px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                </div>
                <div style={{ backgroundColor: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '10px' }}>
                  <button onClick={handleCaptureCampoGPS} type="button" style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', width: '100%', marginBottom: '4px' }}>🛰️ Capturar GPS Actual</button>
                  <p style={{ fontSize: '10px', color: campoGPS ? '#16a34a' : '#dc2626', fontWeight: 'bold', margin: 0, textAlign: 'center' }}>{campoGpsStatus}</p>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Fotografía de Evidencia:</label>
                  <input type="file" accept="image/*" capture="environment" onChange={(e) => setCampoFotoFile(e.target.files?.[0] || null)} style={{ fontSize: '11px', width: '100%' }} />
                </div>
                <button onClick={handleSaveCampoRecord} disabled={campoSaving} type="button" style={{ width: '100%', backgroundColor: campoSaving ? '#94a3b8' : '#16a34a', color: '#ffffff', padding: '10px', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                  {campoSaving ? '⏳ Guardando...' : '💾 Guardar y Publicar en Mapa'}
                </button>
              </div>
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
  <h3 style={{ fontSize: '13px', color: '#1e3a8a', margin: '0 0 8px 0' }}>🗺️ Mapa de Localización de Luminarias</h3>
  <div ref={mapContainerRef} style={{ width: '100%', height: '380px', minHeight: '380px', borderRadius: '6px', border: '1px solid #94a3b8', zIndex: 1 }} />
</div>
            </div>
          </div>
        )}

        {activeTab === 'admin_consola' && (userRole === 'superadmin' || userRole === 'admin_sst') && (
          <div style={{ padding: '15px 0' }}>
            {userRole === 'superadmin' && (
              <section style={{ margin: '0 0 15px', padding: '12px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                <h3 style={{ margin: '0 0 6px', color: '#1e3a8a', fontSize: '15px' }}>Crear nuevo usuario</h3>
                <p style={{ margin: '0 0 10px', color: '#475569', fontSize: '12px' }}>
                  Desde aquí, el superadministrador inicia el registro de cada persona que necesitará ingresar a TECNOPROYECTOS SST.
                </p>
                <ol style={{ margin: '0 0 12px 18px', padding: 0, color: '#334155', fontSize: '12px', lineHeight: 1.65 }}>
                  <li>Escribe el correo electrónico personal o corporativo del nuevo usuario y envía la invitación.</li>
                  <li>La persona recibirá un correo con un código de verificación. Debe revisar también la carpeta de correo no deseado.</li>
                  <li>Debe abrir la aplicación, elegir <strong>«¿Primera vez? Aceptar invitación con código»</strong> e ingresar el mismo correo y el código recibido.</li>
                  <li>Después de verificar el código, podrá crear su propia contraseña y entrar con su correo y contraseña.</li>
                </ol>
                <p style={{ margin: '0 0 10px', color: '#92400e', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '5px', padding: '8px', fontSize: '11px' }}>
                  Importante: enviar la invitación no define una contraseña. El usuario debe completar estos pasos personalmente para activar su acceso. No compartas ni solicites su código de verificación.
                </p>
                <form onSubmit={handleSendPreviewInvite} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Correo electrónico del nuevo usuario"
                    aria-label="Correo electrónico del nuevo usuario"
                    style={{ flex: '1 1 260px', minWidth: '180px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '12px' }}
                  />
                  <button
                    type="submit"
                    disabled={isSendingInvite || !inviteEmail.trim()}
                    style={{ padding: '8px 12px', border: 'none', borderRadius: '5px', backgroundColor: isSendingInvite ? '#94a3b8' : '#1e3a8a', color: '#fff', fontSize: '12px', fontWeight: 'bold', cursor: isSendingInvite ? 'wait' : 'pointer' }}
                  >
                    {isSendingInvite ? 'Enviando...' : 'Crear usuario y enviar invitación'}
                  </button>
                </form>
                {inviteMessage && <p role="status" style={{ margin: '9px 0 0', color: '#166534', fontSize: '12px' }}>{inviteMessage}</p>}
                {inviteError && <p role="alert" style={{ margin: '9px 0 0', color: '#b91c1c', fontSize: '12px' }}>No se pudo enviar: {inviteError}</p>}
              </section>
            )}
            <div style={{ display: 'none' }} className="print-header">
              <h2 style={{ fontSize: '16pt', fontWeight: 'bold' }}>REPORTE OFICIAL DE INTERVENTORÍA Y CONTROL TÉCNICO</h2>
              <p style={{ fontSize: '9pt', color: '#555' }}>Sistema de Gestión e Inspección de Alumbrado Público – Cumplimiento Normativo</p>
              <p style={{ fontSize: '8pt', color: '#777', marginTop: '4px' }}>
                Generado el: {new Date().toLocaleString()} | Total Registros: {datosCache.length}
              </p>
              <hr style={{ margin: '10px 0', border: '0', borderTop: '1px solid #000' }} />
            </div>

            <h2 style={{ color: '#1e3a8a', fontSize: '17px', marginBottom: '8px' }}>📊 Consola de Interventoría y Auditoría - Alumbrado Público</h2>
            <p style={{ color: '#475569', fontSize: '12px', marginBottom: '15px' }}>Control Técnico y Auditoría RETILAP</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '15px' }}>
              <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', borderLeft: '4px solid #2563eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold' }}>Inventario Verificado</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>{datosCache.length}</div>
              </div>
              <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', borderLeft: '4px solid #059669', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold' }}>Evidencia Fotográfica</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>
                  {datosCache.length > 0 ? Math.round((datosCache.filter(r => r.foto_base64 && r.foto_base64.length > 100).length / datosCache.length) * 100) : 0}%
                </div>
              </div>
              <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', borderLeft: '4px solid #d97706', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold' }}>Incidencias Pendientes</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>
                  {datosCache.filter(r => r.estado_incidencia && r.estado_incidencia !== 'OPERATIVA' && r.estado_incidencia !== 'ATENDIDA').length}
                </div>
              </div>
              <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', borderLeft: '4px solid #4f46e5', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold' }}>Inspecciones (30 días)</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>
                  {datosCache.filter(r => {
                    if (!r.timestamp) return false;
                    const d = new Date(); d.setDate(d.getDate() - 30);
                    return new Date(r.timestamp) >= d;
                  }).length}
                </div>
              </div>
            </div>

            <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '15px' }}>
              <h3 style={{ fontSize: '13px', color: '#1e3a8a', margin: '0 0 8px 0' }}>Georreferenciación y Cobertura de Activos</h3>
              <div ref={adminMapRef} style={{ width: '100%', height: '320px', borderRadius: '6px', border: '1px solid #cbd5e1', position: 'relative', zIndex: 1, minHeight: '320px' }} />
            </div>

            <div style={{ background: '#fff', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '15px', overflow: 'hidden' }}>
              <div onClick={() => setCuadrillasAbierto(!cuadrillasAbierto)} style={{ padding: '10px 15px', background: '#f8fafc', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
                <span>📊 Analítica Operativa y Desempeño de Cuadrillas</span>
                <span>{cuadrillasAbierto ? '▲ Ocultar' : '▼ Desplegar'}</span>
              </div>
              {cuadrillasAbierto && (
                <div style={{ padding: '12px' }}>
                  <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>Consolidado de registros aportados por cada técnico en campo:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {Object.entries(
                      datosCache.reduce((acc: any, r: any) => {
                        const usr = r.usuario || "Sin identificar";
                        acc[usr] = (acc[usr] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([usr, count]: [string, any]) => (
                      <div key={usr} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '4px 10px', fontSize: '11px' }}>
                        <b>👤 {usr}</b>: <span style={{ color: '#2563eb', fontWeight: 'bold' }}>{count}</span> inspecciones
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: '500' }}>
                  Registros filtrados: <span style={{ fontWeight: 'bold', color: '#2563eb' }}>{datosFiltrados.length}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button onClick={cargarRegistrosCliente} style={{ background: '#e2e8f0', color: '#334155', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Actualizar Datos</button>
                  <button onClick={exportarCSV} style={{ background: '#059669', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Exportar CSV</button>
                  <button onClick={() => window.print()} style={{ background: '#4f46e5', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Descargar Reporte PDF</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#475569', marginBottom: '2px' }}>Buscar (Poste, Sector, Técnico)</label>
                  <input type="text" value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} placeholder="Ej: POSTE 12, Centro..." style={{ width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#475569', marginBottom: '2px' }}>Filtrar por Actividad</label>
                  <select value={filtroActividad} onChange={(e) => setFiltroActividad(e.target.value)} style={{ width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px' }}>
                    <option value="">Todas las actividades</option>
                    {[...new Set(datosCache.map(i => i.tipo_actividad).filter(Boolean))].map(act => (
                      <option key={act} value={act}>{act}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#475569', marginBottom: '2px' }}>Estado / Incidencia</label>
                  <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px' }}>
                    <option value="">Todos los estados</option>
                    <option value="PENDIENTE">Incidencias Pendientes</option>
                    <option value="OPERATIVA">Operativas / Normales</option>
                    <option value="ATENDIDA">Atendidas / Corregidas</option>
                  </select>
                </div>
                <div>
                  <button onClick={limpiarFiltros} style={{ width: '100%', background: '#e2e8f0', color: '#334155', border: 'none', padding: '6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Limpiar Filtros</button>
                </div>
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '6px', border: '1px solid #cbd5e1', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '10px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px' }}>ID Poste</th>
                    <th style={{ padding: '8px' }}>Tipo Luminaria</th>
                    <th style={{ padding: '8px' }}>Vatiaje</th>
                    <th style={{ padding: '8px' }}>Evaluación Lux</th>
                    <th style={{ padding: '8px' }}>Actividad / Hallazgo</th>
                    <th style={{ padding: '8px' }}>Estado Incidencia</th>
                    <th style={{ padding: '8px' }}>Sector / Barrio</th>
                    <th style={{ padding: '8px' }}>Descripción</th>
                    <th style={{ padding: '8px' }}>Técnico</th>
                    <th style={{ padding: '8px' }}>Coordenadas GPS</th>
                    <th style={{ padding: '8px' }}>Fecha</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Evidencia</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {datosFiltrados.length === 0 ? (
                    <tr><td colSpan={13} style={{ textAlign: 'center', padding: '20px', color: '#d97706' }}>No se encontraron registros en el filtro actual.</td></tr>
                  ) : (
                    datosFiltrados.map((reg) => {
                      const estado = reg.estado_incidencia || 'OPERATIVA';
                      const badgeBg = estado === 'ATENDIDA' ? '#e0e7ff' : (estado === 'OPERATIVA' ? '#d1fae5' : '#fee2e2');
                      const badgeColor = estado === 'ATENDIDA' ? '#3730a3' : (estado === 'OPERATIVA' ? '#065f46' : '#991b1b');
                      const imgId = `table_img_${reg.id}`;

                      return (
                        <tr key={reg.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px', fontWeight: 'bold', color: '#0f172a' }}>{reg.id_poste || 'N/D'}</td>
                          <td style={{ padding: '8px' }}><strong>{reg.tipo_luminaria || 'No especificado'}</strong></td>
                          <td style={{ padding: '8px' }}>{reg.vatiaje || 'N/A'}</td>
                          <td style={{ padding: '8px' }}><span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '2px 4px', borderRadius: '4px', fontSize: '10px' }}>{reg.evaluacion_lux || 'CONFORME'}</span></td>
                          <td style={{ padding: '8px' }}><span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '2px 4px', borderRadius: '4px', fontSize: '10px' }}>{reg.tipo_actividad || 'N/D'}</span></td>
                          <td style={{ padding: '8px' }}><span style={{ backgroundColor: badgeBg, color: badgeColor, padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>{estado}</span></td>
                          <td style={{ padding: '8px' }}>{reg.sector_barrio || 'N/D'}</td>
                          <td style={{ padding: '8px', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={reg.descripcion_trabajo}>{reg.descripcion_trabajo || 'N/D'}</td>
                          <td style={{ padding: '8px', color: '#64748b' }}>{reg.usuario || 'N/D'}</td>
                          <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '10px', color: '#64748b' }}>{reg.latitud}, {reg.longitud}</td>
                          <td style={{ padding: '8px', fontSize: '10px', color: '#64748b' }}>{reg.timestamp ? new Date(reg.timestamp).toLocaleString() : 'N/D'}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            {reg.foto_base64 ? (
                              <button onClick={() => setModalFotoUrl(reg.foto_base64)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <img id={imgId} src={reg.foto_base64.startsWith('data:') ? reg.foto_base64 : ''} onLoad={() => { if(!reg.foto_base64.startsWith('data:')) cargarMiniaturaSegura(reg.foto_base64, imgId); }} alt="Evidencia" style={{ width: '35px', height: '35px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                              </button>
                            ) : <span style={{ fontSize: '10px', color: '#94a3b8' }}>Sin foto</span>}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            {estado !== 'OPERATIVA' && estado !== 'ATENDIDA' ? (
                              <button onClick={() => marcarAtendida(reg.id)} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '3px 6px', fontSize: '10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Marcar Atendida</button>
                            ) : <span style={{ fontSize: '10px', color: '#94a3b8' }}>N/A</span>}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {modalFotoUrl && (
          <div onClick={() => setModalFotoUrl(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '15px' }}>
            <div style={{ textAlign: 'center' }}>
              <img src={modalFotoUrl} style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '8px', objectFit: 'contain' }} alt="Evidencia Grande" />
              <p style={{ color: '#fff', fontSize: '11px', marginTop: '8px' }}>Haz clic en cualquier parte para cerrar</p>
            </div>
          </div>
        )}

        {activeTab === 'firma' && canAccessFirma && (
          <div>
            <div style={{ backgroundColor: '#f8fafc', padding: '12px 15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '15px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#0f172a' }}>1. Datos del Firmante</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Nombre Completo:</label><input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} /></div>
                <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Cédula / Documento:</label><input type="text" value={signerDoc} onChange={(e) => setSignerDoc(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} /></div>
                <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Cargo / Rol:</label><input type="text" value={signerRole} onChange={(e) => setSignerRole(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} /></div>
              </div>
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: '12px 15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '15px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#0f172a' }}>2. Cargar Documento PDF del SG-SST</h3>
              <input type="file" accept="application/pdf" onChange={handlePdfUpload} style={{ padding: '6px', border: '1px dashed #0284c7', borderRadius: '6px', width: '95%' }} />
              {pdfFile && <p style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '12px', marginTop: '6px' }}>📄 Cargado: {pdfFile.name}</p>}
            </div>
            {pdfDocJs && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '14px', color: '#0f172a' }}>3. Vista Previa Hoja</h3>
                    <select value={selectedPage} onChange={(e) => setSelectedPage(Number(e.target.value))} style={{ padding: '3px 6px', borderRadius: '4px' }}>
                      {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (<option key={p} value={p}>Página {p} de {numPages}</option>))}
                    </select>
                  </div>
                  <div style={{ position: 'relative', border: '2px solid #0284c7', borderRadius: '6px', overflow: 'auto', maxHeight: '480px', backgroundColor: '#64748b', padding: '8px', textAlign: 'center' }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <canvas ref={pdfCanvasRef} style={{ display: 'block', backgroundColor: '#fff', maxWidth: '100%', height: 'auto' }} />
                      {signatureImage && (
                        <div style={{ position: 'absolute', left: `${posXPercent}%`, top: `${posYPercent}%`, transform: 'translate(-50%, -50%)', border: '2px dashed #0284c7', backgroundColor: 'rgba(255,255,255,0.85)', padding: '3px', borderRadius: '4px', width: `${sigScale}px`, textAlign: 'center' }}>
                          <img src={signatureImage} alt="Firma" style={{ width: '100%', maxHeight: '50px', objectFit: 'contain' }} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#0f172a' }}>4. Ajuste y Firma Táctil</h3>
                  <div style={{ backgroundColor: '#f1f5f9', padding: '10px 12px', borderRadius: '6px', marginBottom: '12px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Horizontal: {posXPercent}%</label>
                    <input type="range" min="0" max="100" value={posXPercent} onChange={(e) => setPosXPercent(Number(e.target.value))} style={{ width: '100%', marginBottom: '8px' }} />
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Vertical: {posYPercent}%</label>
                    <input type="range" min="0" max="100" value={posYPercent} onChange={(e) => setPosYPercent(Number(e.target.value))} style={{ width: '100%', marginBottom: '8px' }} />
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Tamaño: {sigScale}px</label>
                    <input type="range" min="100" max="300" step="10" value={sigScale} onChange={(e) => setSigScale(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Dibuje su Firma:</label>
                    <div style={{ minHeight: '180px', width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', touchAction: 'none' }}>
                      <SignatureCanvas ref={signatureRef} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                    <button className="btn" onClick={handleCaptureSignature} style={{ backgroundColor: '#0284c7', padding: '9px', fontSize: '12px', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>📌 Confirmar Trazo</button>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn" onClick={handleClearSignature} style={{ backgroundColor: '#dc2626', flex: 1, padding: '9px', fontSize: '12px', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Limpiar</button>
                      <button className="btn" onClick={handleProcessDocumentSigning} disabled={isProcessing || !signatureImage} style={{ backgroundColor: signatureImage ? '#16a34a' : '#94a3b8', flex: 2, padding: '9px', fontSize: '12px', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{isProcessing ? 'Procesando...' : '⚡ Firmar y Estampar'}</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {signedDocumentUrl && (
              <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#f0fdf4', border: '2px solid #22c55e', borderRadius: '8px', textAlign: 'center' }}>
                <h3 style={{ color: '#15803d', margin: '0 0 8px 0', fontSize: '15px' }}>✅ ¡Documento Firmado con Éxito!</h3>
                <a href={signedDocumentUrl} download="FIRMADO.pdf" style={{ display: 'inline-block', backgroundColor: '#0284c7', fontSize: '14px', padding: '10px 20px', textDecoration: 'none', color: '#fff', borderRadius: '6px' }}>📥 Descargar PDF Firmado</a>
              </div>
            )}
          </div>
        )}

        {activeTab === 'formatos' && (
          <div style={{ padding: '15px 0' }}>
            <h2 style={{ color: '#1e3a8a', fontSize: '17px', marginBottom: '8px' }}>📁 Plantillas oficiales en blanco</h2>
            <p style={{ color: '#475569', fontSize: '12px', marginBottom: '15px' }}>Consulte y descargue las plantillas oficiales sin diligenciar. Para completar y firmar un formato, utilice el módulo Formularios digitales.</p>
            
            {isLoadingDocs ? <p style={{ color: '#0284c7', fontSize: '13px', textAlign: 'center' }}>⏳ Cargando formatos...</p> : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {filteredDocs.map((doc) => (
                  <div key={doc.id} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>{doc.codigo}: {doc.titulo}</strong>
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>Estructura oficial regulada | Plantilla: .{doc.extension}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <a href={doc.url_archivo} target="_blank" rel="noreferrer" style={{ backgroundColor: '#16a34a', padding: '6px 12px', fontSize: '12px', textDecoration: 'none', color: '#fff', borderRadius: '4px' }}>👁️ Ver / Descargar</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'formularios_digitales' && (
          <div style={{ padding: '10px 0' }}>
            <DigitalFormsApp onPdfGenerated={handleArchiveDigitalPdf} />
          </div>
        )}

        {activeTab === 'consulta_formatos' && userRole === 'superadmin' && (
          <div style={{ padding: '15px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 style={{ color: '#1e3a8a', fontSize: '17px', marginBottom: '6px' }}>🗂️ Archivo privado de formatos diligenciados</h2>
                <p style={{ color: '#475569', fontSize: '12px' }}>Solo el superadministrador puede consultar y descargar los PDF archivados.</p>
              </div>
              <button onClick={handleLoadSavedForms} disabled={isLoadingSavedForms} style={{ backgroundColor: '#1e3a8a', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 12px', cursor: 'pointer' }}>
                {isLoadingSavedForms ? 'Consultando...' : 'Actualizar archivo'}
              </button>
            </div>
            {savedFormsError && <p role="alert" style={{ color: '#b91c1c', backgroundColor: '#fef2f2', padding: '10px', borderRadius: '6px', fontSize: '12px' }}>No se pudo consultar el archivo: {savedFormsError}. Verifica que la migración de Supabase haya sido aplicada.</p>}
            {isLoadingSavedForms ? (
              <p style={{ color: '#0284c7', fontSize: '13px' }}>Cargando documentos archivados...</p>
            ) : savedForms.length === 0 ? (
              <div style={{ marginTop: '12px', padding: '20px', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b', fontSize: '12px' }}>No hay formatos archivados para mostrar.</div>
            ) : (
              <div style={{ marginTop: '12px', display: 'grid', gap: '10px' }}>
                {savedForms.map((record) => (
                  <div key={record.id} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <strong style={{ color: '#0f172a', fontSize: '13px' }}>{record.codigo_formato} — {record.titulo_formato}</strong>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>Fecha: {new Date(record.created_at).toLocaleString('es-CO')} · Responsable: {record.firmas?.nombre || 'No registrado'} · Estado: {record.estado}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button onClick={() => void handlePreviewSavedForm(record)} disabled={previewingSavedFormId === record.id} style={{ backgroundColor: '#475569', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 12px', cursor: previewingSavedFormId === record.id ? 'wait' : 'pointer', opacity: previewingSavedFormId === record.id ? 0.7 : 1 }}>
                        {previewingSavedFormId === record.id ? 'Abriendo...' : '👁️ Visualizar'}
                      </button>
                      <button onClick={() => void handleDownloadSavedForm(record)} style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 12px', cursor: 'pointer' }}>📥 Recuperar PDF</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {previewSavedForm && userRole === 'superadmin' && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Vista previa: ${previewSavedForm.title}`}
            style={{ position: 'fixed', inset: 0, zIndex: 2000, backgroundColor: 'rgba(15, 23, 42, 0.82)', display: 'flex', flexDirection: 'column', padding: '16px', boxSizing: 'border-box' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', backgroundColor: '#fff', padding: '10px 14px', borderRadius: '8px 8px 0 0' }}>
              <strong style={{ color: '#0f172a', fontSize: '14px' }}>{previewSavedForm.title}</strong>
              <button onClick={() => setPreviewSavedForm(null)} aria-label="Cerrar vista previa" style={{ backgroundColor: '#b91c1c', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 12px', cursor: 'pointer' }}>✕ Cerrar</button>
            </div>
            <iframe
              src={previewSavedForm.url}
              title={`Vista previa del PDF ${previewSavedForm.title}`}
              style={{ width: '100%', flex: 1, minHeight: 0, border: 'none', backgroundColor: '#e2e8f0', borderRadius: '0 0 8px 8px' }}
            />
            <p style={{ color: '#fff', fontSize: '11px', textAlign: 'center', margin: '8px 0 0' }}>Vista previa temporal y privada. Cierra esta ventana para volver al archivo.</p>
          </div>
        )}

        {activeTab !== 'firma' && activeTab !== 'formatos' && activeTab !== 'consulta_formatos' && activeTab !== 'campo' && activeTab !== 'admin_consola' && (
          <div style={{ padding: '15px 0' }}>
            <h2 style={{ color: '#1e3a8a', fontSize: '17px', marginBottom: '8px', textTransform: 'capitalize' }}>
              📄 Módulo de {activeTab} SG-SST
            </h2>
            {isLoadingDocs ? (
              <p style={{ color: '#0284c7' }}>Cargando documentos...</p>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {filteredDocs.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#64748b' }}>
                    No hay documentos registrados en esta categoría.
                  </p>
                ) : (
                  filteredDocs.map((doc) => (
                    <div key={doc.id} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{doc.codigo}: {doc.titulo}</strong>
                        <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                          Versión: {doc.version} | Extensión: .{doc.extension}
                        </p>
                      </div>
                      <a href={doc.url_archivo} target="_blank" rel="noreferrer" style={{ backgroundColor: '#0284c7', padding: '6px 12px', fontSize: '12px', textDecoration: 'none', color: '#fff', borderRadius: '4px' }}>
                        👁️ Ver / Descargar Documento
                      </a>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: '25px', paddingTop: '15px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Powered by</span>
          <img src="https://static.wixstatic.com/media/d0ce54_c999d1aa9976438a98b0f5b2157b7adc~mv2.png" alt="Logo Desarrollador" style={{ height: '24px', objectFit: 'contain' }} />
        </div>
      </div>
    </div>
  );
}

export default App;
