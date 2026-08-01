import { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import { Download, Search, Filter, Calendar, ClipboardList, Clock, Users, Eye, X, Trash2, Image as ImageIcon, BarChart2, Award, Edit, FileText } from 'lucide-react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend } from 'recharts';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useRef } from 'react';

export default function AdminHistory() {
  const [attendances, setAttendances] = useState([]);
  const [users, setUsers] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isRangeMode, setIsRangeMode] = useState(false);
  // Filters state
  const [filters, setFilters] = useState({
    fechaInicio: dayjs().format('YYYY-MM-DD'),
    fechaFin: dayjs().format('YYYY-MM-DD'),
    usuarioId: '',
    sedeId: ''
  });

  const [activeTab, setActiveTab] = useState('general');
  const [selectedEmployeeDetails, setSelectedEmployeeDetails] = useState(null);
  
  // Extra hours approval state
  const [approvingExtra, setApprovingExtra] = useState(null);
  const [extraMinutesToApprove, setExtraMinutesToApprove] = useState('');

  // Report State
  const [reportData, setReportData] = useState([]);
  const [loadingReport, setLoadingReport] = useState(true);
  const reportRef = useRef(null);
  const reportPuntualesRef = useRef(null);
  const reportAusentismosRef = useRef(null);
  const reportDetalleRef = useRef(null);
  const reportGeneralRef = useRef(null);
  const reportLunchDetalleRef = useRef(null);
  const [selectedEmployeeLunchDetails, setSelectedEmployeeLunchDetails] = useState(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingPDFPuntuales, setIsExportingPDFPuntuales] = useState(false);
  const [isExportingPDFAusentismos, setIsExportingPDFAusentismos] = useState(false);
  const [isExportingPDFDetalle, setIsExportingPDFDetalle] = useState(false);
  const [isExportingPDFGeneral, setIsExportingPDFGeneral] = useState(false);
  const [isExportingPDFLunchDetalle, setIsExportingPDFLunchDetalle] = useState(false);
  
  const [manualEntryAttendance, setManualEntryAttendance] = useState(null);
  const [manualEntryTime, setManualEntryTime] = useState('');
  const [manualExitTime, setManualExitTime] = useState('');

  // Justification State
  const [justifyingAttendance, setJustifyingAttendance] = useState(null);
  const [justificationText, setJustificationText] = useState('');
  const [justificationFile, setJustificationFile] = useState(null);
  const [isSubmittingJustification, setIsSubmittingJustification] = useState(false);

  const loadFiltersData = async () => {
    try {
      const [usersRes, formRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/form-data')
      ]);
      setUsers(usersRes.data);
      setSedes(formRes.data.sedes);
    } catch (error) {
      console.error('Error cargando datos de filtros:', error);
    }
  };

  const loadAttendances = async () => {
    setLoading(true);
    try {
      // Clean empty filters
      const params = new URLSearchParams();
      if (filters.fechaInicio) params.append('fechaInicio', filters.fechaInicio);
      if (filters.fechaFin) params.append('fechaFin', filters.fechaFin);
      if (filters.usuarioId) params.append('usuarioId', filters.usuarioId);
      if (filters.sedeId) params.append('sedeId', filters.sedeId);

      const res = await api.get(`/admin/attendances?${params.toString()}`);
      setAttendances(res.data);
    } catch (error) {
      console.error('Error cargando asistencias:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiltersData();
    loadAttendances();
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => {
      const newFilters = { ...prev, [name]: value };
      if (!isRangeMode && name === 'fechaInicio') {
        newFilters.fechaFin = value;
      }
      return newFilters;
    });
  };

  const processedAttendances = attendances;
  const filteredAttendances = activeTab === 'reporte_almuerzos'
    ? processedAttendances.filter(a => a.horaSalidaAlmuerzo)
    : processedAttendances;

  const dynamicReportData = useMemo(() => {
    const counts = {};
    
    processedAttendances.forEach(t => {
      if (t.causaTardanza) {
        counts[t.causaTardanza] = (counts[t.causaTardanza] || 0) + 1;
      }
      if (t.causaTardanzaAlmuerzo) {
        counts[t.causaTardanzaAlmuerzo] = (counts[t.causaTardanzaAlmuerzo] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [processedAttendances]);

  const formatMinutes = (mins) => {
    if (!mins) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const getConsolidatedData = () => {
    const grouped = {};
    processedAttendances.forEach(a => {
      if (!grouped[a.usuarioId]) {
        grouped[a.usuarioId] = {
          usuarioId: a.usuarioId,
          usuario: a.usuario,
          sede: a.sede,
          diasAsistidos: 0,
          llegadasTarde: 0,
          tardesAlmuerzo: 0,
          faltas: 0,
          vacaciones: 0,
          totalMinutosExtra: 0,
          totalMinutosTarde: 0
        };
      }
      
      // Contar estados
      if (a.estado.nombre === 'AUSENTE') {
        grouped[a.usuarioId].faltas++;
      } else if (a.estado.nombre === 'VACACIONES') {
        grouped[a.usuarioId].vacaciones++;
      } else {
        // Solo cuenta como día asistido si no faltó ni estuvo de vacaciones
        grouped[a.usuarioId].diasAsistidos++;
      }

      if (a.estado.nombre === 'TARDE') grouped[a.usuarioId].llegadasTarde++;
      if (a.causaTardanzaAlmuerzo) grouped[a.usuarioId].tardesAlmuerzo++;
      if (a.minutosExtraAprobados) grouped[a.usuarioId].totalMinutosExtra += a.minutosExtraAprobados;
      if (a.minutosTarde) grouped[a.usuarioId].totalMinutosTarde += a.minutosTarde;
    });
    return Object.values(grouped).sort((a, b) => b.diasAsistidos - a.diasAsistidos);
  };

  const consolidatedData = getConsolidatedData();

  const getExtrasConsolidatedData = () => {
    const grouped = {};
    processedAttendances.forEach(a => {
      if (!a.minutosExtra && !a.minutosExtraAprobados) return;

      if (!grouped[a.usuarioId]) {
        grouped[a.usuarioId] = {
          usuarioId: a.usuarioId,
          usuario: a.usuario,
          sede: a.sede,
          diasConExtras: 0,
          minutosExtraGenerados: 0,
          minutosExtraAprobados: 0,
          minutosExtraRechazados: 0,
          minutosExtraPendientes: 0,
        };
      }
      
      const g = grouped[a.usuarioId];
      
      if (a.minutosExtra > 0 || a.minutosExtraAprobados > 0) {
        g.diasConExtras++;
        g.minutosExtraGenerados += (a.minutosExtra || 0);
        
        if (a.estadoExtras === 'APROBADO') {
          g.minutosExtraAprobados += (a.minutosExtraAprobados || 0);
        } else if (a.estadoExtras === 'RECHAZADO') {
          g.minutosExtraRechazados += (a.minutosExtra || 0);
        } else if (a.estadoExtras === 'PENDIENTE') {
          g.minutosExtraPendientes += (a.minutosExtra || 0);
        }
      }
    });
    
    return Object.values(grouped).sort((a, b) => b.minutosExtraAprobados - a.minutosExtraAprobados);
  };

  const extrasConsolidatedData = getExtrasConsolidatedData();

  const getPuntualidadRanking = () => {
    const userTimes = {};
    
    filteredAttendances.forEach(a => {
      if (a.estado.nombre === 'VACACIONES') return; // Ignorar vacaciones para no alterar el promedio
      
      let minutesFromMidnight = 0;
      
      if (!a.horaEntrada || a.estado.nombre === 'AUSENTE') {
        // Asumimos AUSENTE
        // Sumar 7.5 horas del día laboral, o 4.5 horas si es sábado
        const horaInicioStr = a.usuario?.horario?.horaInicio || '08:00:00';
        const [h, m] = horaInicioStr.split(':').map(Number);
        const shiftStartMins = h * 60 + (m || 0);
        
        const isSaturday = dayjs(a.fecha).day() === 6; // 6 es Sábado
        const penaltyMins = isSaturday ? 270 : 450; // 4.5h o 7.5h
        
        minutesFromMidnight = shiftStartMins + penaltyMins;
      } else {
        const entryTime = dayjs(a.horaEntrada);
        minutesFromMidnight = entryTime.hour() * 60 + entryTime.minute();
      }
      
      if (!userTimes[a.usuarioId]) {
        userTimes[a.usuarioId] = {
          name: `${a.usuario.nombre} ${a.usuario.apellido}`,
          shortName: `${a.usuario.nombre.split(' ')[0]} ${a.usuario.apellido.split(' ')[0]}`,
          documento: a.usuario.documento,
          totalMinutes: 0,
          count: 0
        };
      }
      
      userTimes[a.usuarioId].totalMinutes += minutesFromMidnight;
      userTimes[a.usuarioId].count += 1;
    });
    
    const averaged = Object.values(userTimes).map(u => {
      const avgMins = Math.round(u.totalMinutes / u.count);
      const hh = Math.floor(avgMins / 60);
      const mm = avgMins % 60;
      const isPM = hh >= 12;
      const displayH = hh % 12 === 0 ? 12 : hh % 12;
      const formattedTime = `${displayH.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
      
      return {
        name: u.shortName,
        fullName: u.name,
        documento: u.documento,
        diasAsistidos: u.count,
        avgMins: avgMins,
        avgTimeFormatted: formattedTime
      };
    });
    
    // Sort by lowest avgMins (earliest arrivals)
    return averaged.sort((a, b) => a.avgMins - b.avgMins);
  };

  const getLunchConsolidatedData = () => {
    const grouped = {};
    filteredAttendances.forEach(a => {
      if (!grouped[a.usuarioId]) {
        grouped[a.usuarioId] = {
          usuarioId: a.usuarioId,
          usuario: a.usuario,
          sede: a.sede,
          diasConAlmuerzo: 0,
          totalMinutosAlmuerzo: 0,
        };
      }
      
      if (a.horaSalidaAlmuerzo && a.horaEntradaAlmuerzo) {
        const salida = dayjs(a.horaSalidaAlmuerzo);
        const entrada = dayjs(a.horaEntradaAlmuerzo);
        const diff = entrada.diff(salida, 'minute');
        grouped[a.usuarioId].diasConAlmuerzo++;
        grouped[a.usuarioId].totalMinutosAlmuerzo += diff;
      }
    });
    
    return Object.values(grouped).filter(c => c.diasConAlmuerzo > 0).sort((a, b) => b.diasConAlmuerzo - a.diasConAlmuerzo);
  };

  const lunchConsolidatedData = getLunchConsolidatedData();

  const puntualidadRanking = getPuntualidadRanking();
  const topPuntuales = puntualidadRanking.slice(0, 5);

  const handleViewDetails = (usuarioId) => {
    setSelectedEmployeeDetails(usuarioId);
  };

  const handleApplyFilters = (e) => {
    e.preventDefault();
    loadAttendances();
  };

  const handleDeleteAttendance = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar este registro de asistencia? Esta acción no se puede deshacer.')) {
      try {
        await api.delete(`/admin/attendances/${id}`);
        loadAttendances();
      } catch (error) {
        alert('Error al eliminar el registro de asistencia');
      }
    }
  };

  const handleApproveExtras = async () => {
    if (!approvingExtra) return;
    try {
      await api.put(`/admin/attendances/${approvingExtra.id}/approve-extras`, {
        minutosAprobados: Number(extraMinutesToApprove),
        estadoExtras: 'APROBADO'
      });
      setApprovingExtra(null);
      loadAttendances();
    } catch (error) {
      alert('Error al aprobar las horas extras');
    }
  };

  const handleRejectExtras = async () => {
    if (!approvingExtra) return;
    if (window.confirm('¿Seguro que deseas rechazar estas horas extras?')) {
      try {
        await api.put(`/admin/attendances/${approvingExtra.id}/approve-extras`, {
          minutosAprobados: 0,
          estadoExtras: 'RECHAZADO'
        });
        setApprovingExtra(null);
        loadAttendances();
      } catch (error) {
        alert('Error al rechazar las horas extras');
      }
    }
  };

  const handleManualEntrySubmit = async (e) => {
    e.preventDefault();
    if (!manualEntryAttendance || !manualEntryTime) return;
    try {
      await api.put(`/admin/attendances/${manualEntryAttendance.id}/manual-entry`, {
        horaEntrada: manualEntryTime,
        horaSalida: manualExitTime || undefined
      });
      setManualEntryAttendance(null);
      setManualEntryTime('');
      setManualExitTime('');
      loadAttendances();
    } catch (error) {
      alert('Error al guardar el ingreso manual');
    }
  };

  const handleJustifySubmit = async (e) => {
    e.preventDefault();
    if (!justifyingAttendance || !justificationText.trim()) return;
    
    setIsSubmittingJustification(true);
    try {
      const formData = new FormData();
      formData.append('observaciones', 'Justificado: ' + justificationText);
      formData.append('tipo', 'ENTRADA'); // Usa la rama principal de observaciones en el backend
      if (justificationFile) {
        formData.append('evidencia', justificationFile);
      }

      await api.patch(`/attendance/${justifyingAttendance.id}/justify`, formData);
      
      setJustifyingAttendance(null);
      setJustificationText('');
      setJustificationFile(null);
      loadAttendances();
    } catch (error) {
      alert('Error al guardar la justificación: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsSubmittingJustification(false);
    }
  };

  const isJustified = (obs) => {
    if (!obs) return false;
    return obs.startsWith('Justificado:');
  };

  const handleExportExcel = () => {
    try {
      if (attendances.length === 0) {
        alert('No hay datos para exportar en este rango.');
        return;
      }

      // Preparar datos para Excel
      const excelData = processedAttendances.map(a => ({
        'Fecha': dayjs.utc(a.fecha).format('DD/MM/YYYY'), // Ajuste simple si fecha guarda midnight UTC
        'Entrada': a.horaEntrada ? dayjs(a.horaEntrada).format('hh:mm A') : 'N/A',
        'Salida Almuerzo': a.horaSalidaAlmuerzo ? dayjs(a.horaSalidaAlmuerzo).format('hh:mm A') : 'N/A',
        'Regreso Almuerzo': a.horaEntradaAlmuerzo ? dayjs(a.horaEntradaAlmuerzo).format('hh:mm A') : 'N/A',
        'Salida Jornada': a.horaSalida ? dayjs(a.horaSalida).format('hh:mm A') : 'N/A',
        'Extras (Sistema)': formatMinutes(a.minutosExtra),
        'Extras (Aprobadas)': a.minutosExtraAprobados !== null ? formatMinutes(a.minutosExtraAprobados) : 'Pendiente',
        'Tardanzas': formatMinutes(a.minutosTarde),
        'Documento': a.usuario.documento,
        'Empleado': `${a.usuario.nombre} ${a.usuario.apellido}`,
        'Sede': a.sede.nombre,
        'Estado (Día)': a.estado.nombre,
        'Hora Inicio Almuerzo': a.horaSalidaAlmuerzo ? dayjs(a.horaSalidaAlmuerzo).format('hh:mm A') : 'N/A',
        'Hora Fin Almuerzo': a.horaEntradaAlmuerzo ? dayjs(a.horaEntradaAlmuerzo).format('hh:mm A') : 'N/A',
        'Minutos Tarde': formatMinutes(a.minutosTarde),
        'Causa Tardanza (Mañana)': a.causaTardanza || 'N/A',
        'Justificación (Mañana)': a.observaciones || 'N/A',
        'Causa Tardanza (Almuerzo)': a.causaTardanzaAlmuerzo || 'N/A',
        'Justificación (Almuerzo)': a.observacionesAlmuerzo || 'N/A'
      }));

      // Preparar datos para Excel Consolidado
      const excelConsolidatedData = consolidatedData.map(c => {
        const balance = c.totalMinutosExtra - c.totalMinutosTarde;
        return {
          'Empleado': `${c.usuario.nombre} ${c.usuario.apellido}`,
          'Documento': c.usuario.documento,
          'Sede': c.sede.nombre,
          'Días Asistidos': c.diasAsistidos,
          'Llegadas Tarde': c.llegadasTarde,
          'Faltas': c.faltas,
          'Vacaciones': c.vacaciones,
          'Hrs Extras': formatMinutes(c.totalMinutosExtra),
          'Hrs Tardanzas': formatMinutes(c.totalMinutosTarde),
          'Balance': balance === 0 ? '0m' : balance > 0 ? `+ ${formatMinutes(balance)}` : `- ${formatMinutes(Math.abs(balance))}`
        };
      });

      // Crear libro de trabajo
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const worksheetConsolidado = XLSX.utils.json_to_sheet(excelConsolidatedData);
      
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Detalle Asistencias");
      XLSX.utils.book_append_sheet(workbook, worksheetConsolidado, "Consolidado");

      // Descargar
      const fileName = `Reporte_Asistencia_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('Error al exportar a Excel:', error);
      alert('Error al exportar a Excel: ' + error.message);
    }
  };

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      doc.text("Reporte de Tardanzas", 14, 15);
      
      const head = [["Fecha", "Empleado", "Documento", "Sede", "Entrada", "Min. Tarde", "Causa", "Observaciones"]];
      const body = processedAttendances.filter(a => a.minutosTarde > 0).map(a => [
        dayjs.utc(a.fecha).format('DD MMM, YYYY'),
        `${a.usuario.nombre} ${a.usuario.apellido}`,
        a.usuario.documento,
        a.sede.nombre,
        a.horaEntrada ? dayjs(a.horaEntrada).format('hh:mm A') : 'N/A',
        formatMinutes(a.minutosTarde),
        a.causaTardanza || 'N/A',
        a.observaciones || 'N/A'
      ]);

      autoTable(doc, { head, body, startY: 20, styles: { fontSize: 8 } });
      doc.save(`Reporte_Tardanzas_${dayjs().format('YYYYMMDD')}.pdf`);
    } catch (error) {
      alert('Hubo un error al generar el PDF: ' + error.message);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportPDFAusentismos = async () => {
    setIsExportingPDFAusentismos(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      doc.text("Reporte de Ausentismos", 14, 15);
      
      const head = [["Fecha", "Empleado", "Documento", "Sede", "Estado", "Observaciones"]];
      const body = processedAttendances.filter(a => a.estado.nombre === 'AUSENTE').map(a => [
        dayjs.utc(a.fecha).format('DD MMM, YYYY'),
        `${a.usuario.nombre} ${a.usuario.apellido}`,
        a.usuario.documento,
        a.sede.nombre,
        isJustified(a.observaciones) ? 'JUSTIFICADA' : 'INJUSTIFICADA',
        a.observaciones || 'Ausencia detectada por el sistema automático'
      ]);

      autoTable(doc, { head, body, startY: 20, styles: { fontSize: 8 } });
      doc.save(`Reporte_Ausentismos_${dayjs().format('YYYYMMDD')}.pdf`);
    } catch (error) {
      alert('Hubo un error al generar el PDF: ' + error.message);
    } finally {
      setIsExportingPDFAusentismos(false);
    }
  };

  const handleExportPDFDetalle = async () => {
    setIsExportingPDFDetalle(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const emp = users.find(u => u.id === selectedEmployeeDetails);
      const empName = emp ? emp.nombre : 'Empleado';
      doc.text(`Detalle de Asistencia: ${empName} ${emp ? emp.apellido : ''}`, 14, 15);
      
      const head = [["Fecha", "Entrada", "Salida Almuerzo", "Regreso Almuerzo", "Salida", "Hrs Extras", "Tardanzas"]];
      const empAttendances = attendances.filter(a => a.usuarioId === selectedEmployeeDetails);
      const body = empAttendances.map(a => [
        dayjs.utc(a.fecha).format('DD MMM, YYYY'),
        a.horaEntrada ? dayjs(a.horaEntrada).format('hh:mm A') : 'N/A',
        a.horaSalidaAlmuerzo ? dayjs(a.horaSalidaAlmuerzo).format('hh:mm A') : 'N/A',
        a.horaEntradaAlmuerzo ? dayjs(a.horaEntradaAlmuerzo).format('hh:mm A') : 'N/A',
        a.horaSalida ? dayjs(a.horaSalida).format('hh:mm A') : 'N/A',
        formatMinutes(a.minutosExtra),
        formatMinutes(a.minutosTarde)
      ]);

      autoTable(doc, { head, body, startY: 20, styles: { fontSize: 8 } });
      doc.save(`Detalle_Asistencia_${empName}_${dayjs().format('YYYYMMDD')}.pdf`);
    } catch (error) {
      alert('Hubo un error al generar el PDF: ' + error.message);
    } finally {
      setIsExportingPDFDetalle(false);
    }
  };

  const handleExportPDFPuntuales = async () => {
    setIsExportingPDFPuntuales(true);
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      doc.text("Ranking de Puntualidad", 14, 15);
      
      const head = [["Ranking", "Empleado", "Documento", "Sede", "Entrada", "Días Asist.", "Tardanzas", "Estado"]];
      const body = consolidatedData.sort((a, b) => a.llegadasTarde - b.llegadasTarde).map((c, i) => [
        `#${i + 1}`,
        `${c.usuario.nombre} ${c.usuario.apellido}`,
        c.usuario.documento,
        c.sede.nombre,
        "N/A", // We don't have this in consolidated easily
        c.diasAsistidos.toString(),
        c.llegadasTarde.toString(),
        c.llegadasTarde === 0 ? "PUNTUAL" : "TARDE"
      ]);

      autoTable(doc, { head, body, startY: 20, styles: { fontSize: 8 } });
      doc.save(`Ranking_Puntualidad_${dayjs().format('YYYYMMDD')}.pdf`);
    } catch (error) {
      alert('Hubo un error al generar el PDF: ' + error.message);
    } finally {
      setIsExportingPDFPuntuales(false);
    }
  };

  const handleExportPDFGeneral = async () => {
    setIsExportingPDFGeneral(true);
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      
      let title = "Reporte General de Asistencias";
      if (activeTab === 'reporte_almuerzos') title = "Reporte de Almuerzos";
      if (activeTab === 'consolidado') title = "Reporte Consolidado";
      if (activeTab === 'consolidado_extras') title = "Consolidado Horas Extras";

      doc.setFontSize(14);
      doc.text(title, 14, 15);
      doc.setFontSize(10);
      doc.text(`Periodo: ${dayjs(filters.fechaInicio).format('DD MMM, YYYY')} al ${dayjs(filters.fechaFin).format('DD MMM, YYYY')}`, 14, 22);

      let head = [];
      let body = [];

      if (activeTab === 'general') {
        head = [["Fecha", "Empleado", "Documento", "Sede", "Entrada", "Salida", "Hrs Extras", "Estado", "Observaciones"]];
        body = processedAttendances.map(a => [
          dayjs.utc(a.fecha).format('DD MMM, YYYY'),
          `${a.usuario.nombre} ${a.usuario.apellido}`,
          a.usuario.documento,
          a.sede.nombre,
          a.horaEntrada ? dayjs(a.horaEntrada).format('hh:mm A') : 'N/A',
          a.horaSalida ? dayjs(a.horaSalida).format('hh:mm A') : 'N/A',
          formatMinutes(a.minutosExtra),
          a.estado.nombre,
          a.observaciones || 'Sin observaciones'
        ]);
      } else if (activeTab === 'reporte_almuerzos') {
        head = [["Fecha", "Empleado", "Documento", "Sede", "Salida Almuerzo", "Regreso Almuerzo", "Estado", "Observaciones"]];
        body = processedAttendances.map(a => [
          dayjs.utc(a.fecha).format('DD MMM, YYYY'),
          `${a.usuario.nombre} ${a.usuario.apellido}`,
          a.usuario.documento,
          a.sede.nombre,
          a.horaSalidaAlmuerzo ? dayjs(a.horaSalidaAlmuerzo).format('hh:mm A') : 'N/A',
          a.horaEntradaAlmuerzo ? dayjs(a.horaEntradaAlmuerzo).format('hh:mm A') : 'N/A',
          a.minutosTardeAlmuerzo > 0 ? 'TARDE' : (!a.horaSalidaAlmuerzo ? 'SIN REGISTRO' : 'PUNTUAL'),
          a.observacionesAlmuerzo || 'Sin observaciones'
        ]);
      } else if (activeTab === 'consolidado') {
        head = [["Empleado", "Documento", "Sede", "Días Asist.", "Llegadas Tarde", "Faltas", "Vacaciones", "Hrs Extras", "Tardanzas", "Balance"]];
        body = consolidatedData.map(c => {
          const balance = c.totalMinutosExtra - c.totalMinutosTarde;
          return [
            `${c.usuario.nombre} ${c.usuario.apellido}`,
            c.usuario.documento,
            c.sede.nombre,
            c.diasAsistidos.toString(),
            c.llegadasTarde.toString(),
            c.faltas.toString(),
            c.vacaciones.toString(),
            formatMinutes(c.totalMinutosExtra),
            formatMinutes(c.totalMinutosTarde),
            balance === 0 ? '0m' : balance > 0 ? `+ ${formatMinutes(balance)}` : `- ${formatMinutes(Math.abs(balance))}`
          ];
        });
      } else if (activeTab === 'consolidado_extras') {
        head = [["Empleado", "Documento", "Sede", "Total Hrs Extras", "Estado Aprobación"]];
        body = consolidatedData.map(c => [
          `${c.usuario.nombre} ${c.usuario.apellido}`,
          c.usuario.documento,
          c.sede.nombre,
          formatMinutes(c.totalMinutosExtra),
          c.totalMinutosExtra > 0 ? 'Pendiente revisión' : 'Sin extras'
        ]);
      }

      autoTable(doc, { head, body, startY: 28, styles: { fontSize: 8 }, headStyles: { fillColor: [51, 65, 85] } });
      doc.save(`Reporte_${activeTab}_${dayjs().format('YYYYMMDD')}.pdf`);
    } catch (error) {
      alert('Hubo un error al generar el PDF: ' + error.message);
    } finally {
      setIsExportingPDFGeneral(false);
    }
  };

  const handleExportPDFLunchDetalle = async () => {
    setIsExportingPDFLunchDetalle(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const emp = users.find(u => u.id === selectedEmployeeLunchDetails);
      const empName = emp ? emp.nombre : 'Empleado';
      doc.text(`Detalle de Almuerzos: ${empName} ${emp ? emp.apellido : ''}`, 14, 15);
      
      const head = [["Fecha", "Salida Almuerzo", "Regreso Almuerzo", "Causa", "Observaciones"]];
      const empAttendances = attendances.filter(a => a.usuarioId === selectedEmployeeLunchDetails);
      const body = empAttendances.map(a => [
        dayjs.utc(a.fecha).format('DD MMM, YYYY'),
        a.horaSalidaAlmuerzo ? dayjs(a.horaSalidaAlmuerzo).format('hh:mm A') : 'N/A',
        a.horaEntradaAlmuerzo ? dayjs(a.horaEntradaAlmuerzo).format('hh:mm A') : 'N/A',
        a.causaTardanzaAlmuerzo || 'N/A',
        a.observacionesAlmuerzo || 'N/A'
      ]);

      autoTable(doc, { head, body, startY: 20, styles: { fontSize: 8 } });
      doc.save(`Detalle_Almuerzos_${empName}_${dayjs().format('YYYYMMDD')}.pdf`);
    } catch (error) {
      alert('Hubo un error al generar el PDF: ' + error.message);
    } finally {
      setIsExportingPDFLunchDetalle(false);
    }
  };

  return (
    <div className="p-4 pb-24 md:p-8 md:pb-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-start justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Historial y Reportes</h2>
            <p className="text-slate-500">Filtra y exporta las asistencias de los empleados.</p>
          </div>
          <div className="flex flex-col space-y-3">
            <button 
              onClick={handleExportExcel}
              className="flex items-center justify-center space-x-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm font-medium w-full"
            >
              <Download className="w-5 h-5" />
              <span>Exportar a Excel</span>
            </button>

            {['general', 'reporte_almuerzos', 'consolidado', 'consolidado_extras'].includes(activeTab) && (
              <button 
                onClick={handleExportPDFGeneral}
                disabled={isExportingPDFGeneral}
                className="flex items-center justify-center space-x-2 bg-rose-600 text-white px-5 py-2.5 rounded-xl hover:bg-rose-700 transition-colors shadow-sm font-medium disabled:opacity-50 w-full"
              >
                <Download className="w-5 h-5" />
                <span>{isExportingPDFGeneral ? 'Generando PDF...' : 'Descargar Reporte PDF'}</span>
              </button>
            )}

            {activeTab === 'reportes' && (
              <button 
                onClick={handleExportPDF}
                disabled={isExportingPDF}
                className="flex items-center justify-center space-x-2 bg-rose-600 text-white px-5 py-2.5 rounded-xl hover:bg-rose-700 transition-colors shadow-sm font-medium disabled:opacity-50 w-full"
              >
                <Download className="w-5 h-5" />
                <span>{isExportingPDF ? 'Generando PDF...' : 'Descargar Reporte PDF'}</span>
              </button>
            )}

            {activeTab === 'puntuales' && (
              <button 
                onClick={handleExportPDFPuntuales}
                disabled={isExportingPDFPuntuales}
                className="flex items-center justify-center space-x-2 bg-rose-600 text-white px-5 py-2.5 rounded-xl hover:bg-rose-700 transition-colors shadow-sm font-medium disabled:opacity-50 w-full"
              >
                <Download className="w-5 h-5" />
                <span>{isExportingPDFPuntuales ? 'Generando PDF...' : 'Descargar Ranking PDF'}</span>
              </button>
            )}

            {activeTab === 'ausentismos' && (
              <button 
                onClick={handleExportPDFAusentismos}
                disabled={isExportingPDFAusentismos}
                className="flex items-center justify-center space-x-2 bg-rose-600 text-white px-5 py-2.5 rounded-xl hover:bg-rose-700 transition-colors shadow-sm font-medium disabled:opacity-50 w-full"
              >
                <Download className="w-5 h-5" />
                <span>{isExportingPDFAusentismos ? 'Generando PDF...' : 'Descargar Reporte PDF'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-200/50 p-1 rounded-xl w-full max-w-full overflow-x-auto hide-scrollbar mb-6 gap-1">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex-shrink-0 md:flex-1 px-4 flex items-center justify-center space-x-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'general' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>General</span>
          </button>
          <button
            onClick={() => setActiveTab('reporte_almuerzos')}
            className={`flex-shrink-0 md:flex-1 px-4 flex items-center justify-center space-x-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'reporte_almuerzos' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Reporte Almuerzos</span>
          </button>
          <button
            onClick={() => setActiveTab('consolidado')}
            className={`flex-shrink-0 md:flex-1 px-4 flex items-center justify-center space-x-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'consolidado' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Consolidado por Empleado</span>
            <span className="sm:hidden">Consolidado</span>
          </button>
          <button
            onClick={() => setActiveTab('consolidado_extras')}
            className={`flex-shrink-0 md:flex-1 px-4 flex items-center justify-center space-x-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'consolidado_extras' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Clock className="w-4 h-4 text-indigo-500" />
            <span className="hidden sm:inline">Horas Extras</span>
            <span className="sm:hidden">Extras</span>
          </button>
          <button
            onClick={() => setActiveTab('reportes')}
            className={`flex-shrink-0 md:flex-1 px-4 flex items-center justify-center space-x-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'reportes' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span className="hidden sm:inline">Reportes de Tardanzas</span>
            <span className="sm:hidden">Reportes</span>
          </button>
          <button
            onClick={() => setActiveTab('puntuales')}
            className={`flex-shrink-0 md:flex-1 px-4 flex items-center justify-center space-x-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'puntuales' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Award className="w-4 h-4 text-emerald-500" />
            <span className="hidden sm:inline">Top Puntuales</span>
            <span className="sm:hidden">Top Puntuales</span>
          </button>
          <button
            onClick={() => setActiveTab('ausentismos')}
            className={`flex-shrink-0 md:flex-1 px-4 flex items-center justify-center space-x-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'ausentismos' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <X className="w-4 h-4 text-red-500" />
            <span className="hidden sm:inline">Ausentismos</span>
            <span className="sm:hidden">Faltas</span>
          </button>
        </div>

        {/* Filters Panel */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-6">
          <form onSubmit={handleApplyFilters} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">{isRangeMode ? 'Fecha Inicio' : 'Fecha'}</label>
                <label className="flex items-center space-x-1 cursor-pointer select-none" title="Activar rango de fechas">
                  <input
                    type="checkbox"
                    checked={isRangeMode}
                    onChange={(e) => {
                      setIsRangeMode(e.target.checked);
                      if (!e.target.checked) {
                        setFilters(prev => ({ ...prev, fechaFin: prev.fechaInicio }));
                      }
                    }}
                    className="rounded border-slate-300 text-slate-800 focus:ring-slate-500 w-3.5 h-3.5"
                  />
                  <span className="text-[11px] text-slate-500 font-medium">Rango</span>
                </label>
              </div>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input 
                  type="date" 
                  name="fechaInicio"
                  value={filters.fechaInicio}
                  onChange={handleFilterChange}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none text-sm text-slate-600"
                />
              </div>
            </div>
            
            {isRangeMode ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Fin</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input 
                    type="date" 
                    name="fechaFin"
                    value={filters.fechaFin}
                    onChange={handleFilterChange}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none text-sm text-slate-600"
                  />
                </div>
              </div>
            ) : (
              <div className="hidden md:block"></div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Empleado</label>
              <select 
                name="usuarioId"
                value={filters.usuarioId}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white text-sm text-slate-600"
              >
                <option value="">Todos los empleados</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sede</label>
              <select 
                name="sedeId"
                value={filters.sedeId}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white text-sm text-slate-600"
              >
                <option value="">Todas las sedes</option>
                {sedes.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>

            <button 
              type="submit"
              className="w-full flex items-center justify-center space-x-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors shadow-sm font-medium text-sm h-[38px]"
            >
              <Filter className="w-4 h-4" />
              <span>Filtrar</span>
            </button>
          </form>
        </div>

        {/* Contenido Principal */}
        {activeTab === 'reportes' ? (
          <div className="space-y-6 overflow-x-auto">
            <div ref={reportRef} className="space-y-6 bg-slate-50 p-4 rounded-2xl w-full min-w-max">
              
              <div className="grid grid-cols-1 gap-6">
                {/* Gráfico Animado en Tiempo Real (Reporte de Tardanzas) */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">Causas de Llegadas Tarde</h3>
                      <p className="text-sm text-slate-500">Filtrado por las fechas y parámetros de arriba</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-emerald-600">Sincronizado</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 min-h-[250px] w-full">
                    {dynamicReportData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dynamicReportData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                          <Tooltip 
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          />
                          <Bar 
                            dataKey="count" 
                            name="Nº de Casos"
                            radius={[6, 6, 0, 0]}
                            animationDuration={1500}
                          >
                            {dynamicReportData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#8b5cf6' : '#3b82f6'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm italic">
                        No hay registros de llegadas tarde.
                      </div>
                    )}
                  </div>
                </div>
              </div>


            {/* Tabla Detallada de Tardanzas Filtrada */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-800">Detalle de Tardanzas</h3>
                <p className="text-sm text-slate-500">Filtrado por las fechas y parámetros de arriba</p>
              </div>
              <div className="min-w-full inline-block align-middle">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-4">Fecha / Tipo</th>
                      <th className="px-6 py-4">Empleado</th>
                      <th className="px-6 py-4 text-center">Minutos Tarde (Total)</th>
                      <th className="px-6 py-4">Causas y Justificaciones</th>
                      <th className="px-6 py-4 text-center">Evidencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {processedAttendances.filter(a => a.estado.nombre === 'TARDE').map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="font-medium text-slate-800">{dayjs.utc(a.fecha).format('DD MMM, YYYY')}</p>
                          <div className="flex flex-col space-y-1 mt-1">
                            {a.estado.nombre === 'TARDE' && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 w-fit">Entrada: {dayjs(a.horaEntrada).format('hh:mm A')}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-800">{a.usuario.nombre} {a.usuario.apellido}</p>
                          <p className="text-xs text-slate-500">{a.sede.nombre}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border bg-red-50 text-red-700 border-red-200">
                            {formatMinutes(a.minutosTarde)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 max-w-md">
                          {a.estado.nombre === 'TARDE' && (
                            <div className="mb-2">
                              <p className="font-bold text-slate-800">{a.causaTardanza || 'Causa no especificada (Sistema Anterior)'}</p>
                              <p className="text-slate-600 mt-1 italic text-xs border-l-2 border-slate-300 pl-2">
                                {a.observaciones || 'Sin justificación escrita'}
                              </p>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {a.evidenciaUrl ? (
                            <a
                              href={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}${a.evidenciaUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                              title="Ver evidencia"
                            >
                              <ImageIcon className="w-4 h-4" />
                            </a>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {processedAttendances.filter(a => a.estado.nombre === 'TARDE').length === 0 && (
                      <tr>
                        <td colSpan="5" className="px-6 py-10 text-center text-slate-500">
                          No se encontraron llegadas tarde en el periodo seleccionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          </div>
        ) : activeTab === 'ausentismos' ? (
          <div className="space-y-6 overflow-x-auto">
            <div ref={reportAusentismosRef} className="bg-white rounded-2xl shadow-sm border border-slate-100 w-full min-w-max">
              <div className="p-5 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-800">Reporte de Ausentismos Laborales</h3>
                <p className="text-sm text-slate-500">Empleados que no registraron su asistencia en el día (Filtrado por fecha y sede)</p>
              </div>
              <div className="min-w-full inline-block align-middle">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-4">Fecha</th>
                      <th className="px-6 py-4">Empleado</th>
                      <th className="px-6 py-4 text-center">Estado</th>
                      <th className="px-6 py-4">Observaciones / Detalles</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {processedAttendances.filter(a => a.estado.nombre === 'AUSENTE').map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="font-medium text-slate-800">{dayjs.utc(a.fecha).format('DD MMM, YYYY')}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-800">{a.usuario.nombre} {a.usuario.apellido}</p>
                          <p className="text-xs text-slate-500 font-mono">{a.usuario.documento} • {a.sede.nombre}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {isJustified(a.observaciones) ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border bg-yellow-50 text-yellow-700 border-yellow-200">
                              FALTA JUSTIFICADA
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border bg-red-50 text-red-700 border-red-200">
                              FALTA INJUSTIFICADA
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 max-w-md">
                          <p className={`italic text-xs border-l-2 pl-2 ${isJustified(a.observaciones) ? 'text-yellow-700 border-yellow-300' : 'text-slate-600 border-red-200'}`}>
                            {a.observaciones || 'Ausencia detectada por el sistema automático'}
                          </p>
                          {a.evidenciaUrl && (
                            <a
                              href={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}${a.evidenciaUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={`Evidencia_Justificacion_${dayjs(a.fecha).format('YYYYMMDD')}`}
                              className="mt-2 inline-flex items-center space-x-1 p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition-colors text-xs font-medium border border-blue-200"
                              title="Descargar evidencia"
                            >
                              <Download className="w-3 h-3" />
                              <span>Descargar Evidencia</span>
                            </a>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setJustifyingAttendance(a);
                              const isJust = isJustified(a.observaciones);
                              setJustificationText(isJust ? a.observaciones.replace('Justificado: ', '') : '');
                              setJustificationFile(null);
                            }}
                            className="p-1.5 mr-2 text-slate-400 hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                            title="Justificar Falta"
                          >
                            <ClipboardList className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setManualEntryAttendance(a);
                              setManualEntryTime('08:00');
                              setManualExitTime('');
                            }}
                            className="p-1.5 mr-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title="Ingresar Manualmente"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAttendance(a.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Eliminar falta"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {processedAttendances.filter(a => a.estado.nombre === 'AUSENTE').length === 0 && (
                      <tr>
                        <td colSpan="5" className="px-6 py-10 text-center text-slate-500">
                          No se encontraron ausentismos en el periodo seleccionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'puntuales' ? (
          <div className="space-y-6 overflow-x-auto">
            <div ref={reportPuntualesRef} className="bg-slate-50 p-4 rounded-2xl w-full min-w-max">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                <div className="mb-4 flex items-center space-x-3">
                  <div className="bg-emerald-100 p-2 rounded-xl">
                    <Award className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">Top 5: Empleados Más Puntuales</h3>
                    <p className="text-sm text-slate-500">Por promedio de hora de llegada en la mañana (Filtrado)</p>
                  </div>
                </div>
                
                <div className="w-full h-[400px] mt-4">
                  {topPuntuales.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topPuntuales} margin={{ top: 20, right: 30, left: 20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#64748b' }} />
                        <YAxis 
                          width={80}
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 13, fill: '#64748b' }}
                          domain={['dataMin - 30', 'dataMax + 30']}
                          tickFormatter={(val) => {
                            const hh = Math.floor(val / 60);
                            const mm = Math.round(val % 60);
                            return `${(hh % 12 || 12)}:${mm.toString().padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`;
                          }}
                        />
                        <Tooltip 
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          formatter={(value, name, props) => {
                            return [props.payload.avgTimeFormatted, 'Promedio de Llegada'];
                          }}
                        />
                        <Bar 
                          dataKey="avgMins" 
                          name="Promedio"
                          radius={[6, 6, 0, 0]}
                          animationDuration={1500}
                          barSize={60}
                        >
                          {topPuntuales.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill="#10b981" />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm italic border-2 border-dashed border-slate-100 rounded-xl">
                      No hay suficientes datos para el ranking.
                    </div>
                  )}
                </div>
              </div>
              
              {/* Tabla de Ranking Completo */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-6">
                <div className="p-5 border-b border-slate-100">
                  <h3 className="text-lg font-bold text-slate-800">Ranking Completo de Puntualidad</h3>
                  <p className="text-sm text-slate-500">Listado de todos los empleados ordenados de mejor a menor promedio de hora de llegada</p>
                </div>
                <div className="min-w-full inline-block align-middle">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider">
                        <th className="px-6 py-4 w-16 text-center">Top</th>
                        <th className="px-6 py-4">Empleado</th>
                        <th className="px-6 py-4 text-center">Días Asistidos</th>
                        <th className="px-6 py-4 text-center">Promedio de Llegada</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {puntualidadRanking.map((emp, index) => (
                        <tr key={emp.documento} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                              index === 0 ? 'bg-yellow-100 text-yellow-700' :
                              index === 1 ? 'bg-slate-200 text-slate-700' :
                              index === 2 ? 'bg-amber-100 text-amber-700' :
                              'bg-emerald-50 text-emerald-700'
                            }`}>
                              #{index + 1}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-slate-800">{emp.fullName}</p>
                            <p className="text-xs text-slate-500 font-mono">{emp.documento}</p>
                          </td>
                          <td className="px-6 py-4 text-center font-medium text-slate-600">
                            {emp.diasAsistidos} días
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                              index < 5 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}>
                              {emp.avgTimeFormatted}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {puntualidadRanking.length === 0 && (
                        <tr>
                          <td colSpan="4" className="px-6 py-10 text-center text-slate-500">
                            No se encontraron registros de asistencias para calcular el ranking.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : (
        <div className="space-y-6 overflow-x-auto w-full">
          <div ref={reportGeneralRef} className="bg-white rounded-2xl shadow-sm border border-slate-100 w-full min-w-max">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">
                {activeTab === 'consolidado' ? 'Consolidado por Empleado' : activeTab === 'consolidado_extras' ? 'Consolidado Horas Extras' : activeTab === 'reporte_almuerzos' ? 'Reporte de Almuerzos' : 'Reporte General de Asistencias'}
              </h3>
              <p className="text-sm text-slate-500">
                Periodo: {filters.fechaInicio ? dayjs(filters.fechaInicio).format('DD MMM, YYYY') : '-'} al {filters.fechaFin ? dayjs(filters.fechaFin).format('DD MMM, YYYY') : '-'}
              </p>
            </div>
            <div className="min-w-full inline-block align-middle">
            {loading ? (
              <div className="flex justify-center p-10">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
              </div>
            ) : activeTab === 'consolidado_extras' ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Empleado</th>
                    <th className="px-6 py-4">Sede</th>
                    <th className="px-6 py-4 text-center">Días con Extras</th>
                    <th className="px-6 py-4 text-center">Generadas</th>
                    <th className="px-6 py-4 text-center text-emerald-700">Aprobadas</th>
                    <th className="px-6 py-4 text-center text-red-700">Rechazadas</th>
                    <th className="px-6 py-4 text-center text-amber-700">Pendientes</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {extrasConsolidatedData.map((c) => (
                    <tr key={`extras-cons-${c.usuarioId}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-800">{c.usuario.nombre} {c.usuario.apellido}</p>
                        <p className="text-xs text-slate-500 font-mono">{c.usuario.documento}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-600">{c.sede.nombre}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-slate-700">{c.diasConExtras}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-medium text-slate-600">
                          {formatMinutes(c.minutosExtraGenerados)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                          {formatMinutes(c.minutosExtraAprobados)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-medium text-red-600">
                          {formatMinutes(c.minutosExtraRechazados)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-medium text-amber-600">
                          {formatMinutes(c.minutosExtraPendientes)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleViewDetails(c.usuarioId)}
                          className="inline-flex items-center space-x-1 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Ver Historial</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {extrasConsolidatedData.length === 0 && (
                    <tr>
                      <td colSpan="8" className="px-6 py-10 text-center text-slate-500">
                        No se encontraron registros de horas extras.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : activeTab === 'consolidado' ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Empleado</th>
                    <th className="px-6 py-4 text-center">Días Asistidos</th>
                    <th className="px-6 py-4 text-center">Tardanzas</th>
                    <th className="px-6 py-4 text-center">Extras</th>
                    <th className="px-6 py-4 text-center">Balance Neto</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {consolidatedData.map((c) => (
                    <tr key={c.usuarioId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-800">{c.usuario.nombre} {c.usuario.apellido}</p>
                        <p className="text-xs text-slate-500 font-mono">{c.usuario.documento} • {c.sede.nombre}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-slate-700">{c.diasAsistidos}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                          <p className={`font-bold ${c.llegadasTarde > 0 || c.tardesAlmuerzo > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                            {c.llegadasTarde + c.tardesAlmuerzo} Veces
                          </p>
                          <p className="text-xs text-amber-700">
                            {formatMinutes(c.totalMinutosTarde)}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <p className={`font-medium ${c.totalMinutosExtra > 0 ? 'text-indigo-600' : 'text-slate-600'}`}>
                          {formatMinutes(c.totalMinutosExtra)}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {(() => {
                          const balance = c.totalMinutosExtra - c.totalMinutosTarde;
                          if (balance === 0) return <span className="text-slate-500 font-medium">0m</span>;
                          if (balance > 0) return <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded">+ {formatMinutes(balance)}</span>;
                          return <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded">- {formatMinutes(Math.abs(balance))}</span>;
                        })()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleViewDetails(c.usuarioId)}
                          className="inline-flex items-center space-x-1 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Ver Detalles</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {consolidatedData.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-6 py-10 text-center text-slate-500">
                        No se encontraron registros para los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : activeTab === 'reporte_almuerzos' ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Empleado</th>
                    <th className="px-6 py-4">Sede</th>
                    <th className="px-6 py-4 text-center">Días con Almuerzo</th>
                    <th className="px-6 py-4 text-center">Tiempo Promedio</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {lunchConsolidatedData.map((c) => (
                    <tr key={`lunch-cons-${c.usuarioId}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-800">{c.usuario.nombre} {c.usuario.apellido}</p>
                        <p className="text-xs text-slate-500 font-mono">{c.usuario.documento}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-600">{c.sede.nombre}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-slate-700">{c.diasConAlmuerzo}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {(() => {
                          const avgMins = Math.round(c.totalMinutosAlmuerzo / c.diasConAlmuerzo);
                          return (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border bg-blue-50 text-blue-700 border-blue-200">
                              {avgMins}m
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedEmployeeLunchDetails(c.usuarioId)}
                          className="inline-flex items-center space-x-1 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Ver Historial</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {lunchConsolidatedData.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-6 py-10 text-center text-slate-500">
                        No se encontraron registros de almuerzos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Empleado</th>
                    <th className="px-6 py-4">Sede</th>
                    <th className="px-6 py-4">Horarios Registrados</th>
                    <th className="px-6 py-4">Horas Extras</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4">Observaciones</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAttendances.map((a) => {
                    const isTarde = a.estado.nombre === 'TARDE';
                    const isFalta = a.estado.nombre === 'AUSENTE';
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {/* El campo fecha en la BD guarda UTC midnight, para mostrarlo sin offset, le sumamos las 5 horas o usamos add() para evitar bugs de zona local */}
                          <p className="font-medium text-slate-800">{dayjs.utc(a.fecha).format('DD MMM, YYYY')}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-800">{a.usuario.nombre} {a.usuario.apellido}</p>
                          <p className="text-xs text-slate-500 font-mono">{a.usuario.documento}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-600">{a.sede.nombre}</p>
                        </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs space-y-1">
                              {a.horaEntrada && <p><span className="text-slate-400">Entrada:</span> <span className="font-medium text-slate-700">{dayjs(a.horaEntrada).format('hh:mm A')}</span></p>}
                              {a.horaSalidaAlmuerzo && <p><span className="text-slate-400">Sale Almz:</span> <span className="font-medium text-slate-700">{dayjs(a.horaSalidaAlmuerzo).format('hh:mm A')}</span></p>}
                              {a.horaEntradaAlmuerzo && <p><span className="text-slate-400">Vuelve Almz:</span> <span className="font-medium text-slate-700">{dayjs(a.horaEntradaAlmuerzo).format('hh:mm A')}</span></p>}
                              {a.horaSalida && <p><span className="text-slate-400">Salida:</span> <span className="font-medium text-slate-700">{dayjs(a.horaSalida).format('hh:mm A')}</span></p>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {a.minutosExtra > 0 ? (
                                <div className="flex flex-col space-y-2">
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-indigo-50 text-indigo-700 border-indigo-200 w-fit">
                                    Sistema: + {formatMinutes(a.minutosExtra)}
                                  </span>
                                  {a.estadoExtras === 'APROBADO' ? (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-200 w-fit">
                                      Aprobado: {formatMinutes(a.minutosExtraAprobados)}
                                    </span>
                                  ) : a.estadoExtras === 'RECHAZADO' ? (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-red-50 text-red-700 border-red-200 w-fit">
                                      Rechazadas
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setApprovingExtra(a);
                                        setExtraMinutesToApprove(a.minutosExtra);
                                      }}
                                      className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-1 rounded shadow-sm w-fit transition-colors"
                                    >
                                      Validar Extras
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 font-medium border border-transparent px-2.5 py-1">
                                  0m
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border w-fit ${
                                isTarde ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                                isFalta ? 'bg-red-50 text-red-700 border-red-200' : 
                                'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}>
                                Mañana: {a.estado.nombre}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-500 max-w-xs" title={a.observaciones || a.observacionesAlmuerzo}>
                              <div className="space-y-1">
                                {a.observaciones && <p className="truncate"><span className="font-semibold">Mañana:</span> {a.observaciones}</p>}
                                {a.observacionesAlmuerzo && <p className="truncate"><span className="font-semibold">Almuerzo:</span> {a.observacionesAlmuerzo}</p>}
                                {!a.observaciones && !a.observacionesAlmuerzo && <span className="italic text-slate-400">Sin observaciones</span>}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center justify-end space-x-2">
                                {a.evidenciaUrl && (
                                  <a
                                    href={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}${a.evidenciaUrl}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 flex items-center justify-center"
                                    title="Ver evidencia de la mañana"
                                  >
                                    <ImageIcon className="w-4 h-4" />
                                  </a>
                                )}
                                {a.evidenciaAlmuerzoUrl && (
                                  <a
                                    href={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}${a.evidenciaAlmuerzoUrl}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200 flex items-center justify-center"
                                    title="Ver evidencia del almuerzo"
                                  >
                                    <ImageIcon className="w-4 h-4" />
                                  </a>
                                )}
                                <button
                                  onClick={() => {
                                    setManualEntryAttendance(a);
                                    setManualEntryTime(a.horaEntrada ? dayjs(a.horaEntrada).format('HH:mm') : '08:00');
                                    setManualExitTime(a.horaSalida ? dayjs(a.horaSalida).format('HH:mm') : '');
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                  title="Editar Ingreso / Salida Manualmente"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteAttendance(a.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                      </tr>
                    );
                  })}
                  {filteredAttendances.length === 0 && (
                    <tr>
                      <td colSpan="8" className="px-6 py-10 text-center text-slate-500">
                        No se encontraron registros para los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
            </div>
          </div>
        </div>
        )}

      </div>

      {/* Modal de Detalles */}
      {selectedEmployeeDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Resumen de Asistencia
                </h3>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleExportPDFDetalle}
                  disabled={isExportingPDFDetalle}
                  className="inline-flex items-center space-x-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm shadow-rose-200 disabled:opacity-50"
                >
                  <FileText className="w-4 h-4" />
                  <span>{isExportingPDFDetalle ? 'Generando PDF...' : 'Descargar PDF'}</span>
                </button>
                <button
                  onClick={() => setSelectedEmployeeDetails(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto overflow-x-auto p-6 bg-white">
              <div className="min-w-max bg-white" ref={reportDetalleRef}>
                <div className="mb-6 pb-4 border-b border-slate-100">
                  <h3 className="text-xl font-bold text-slate-800">
                    Reporte Detallado: {users.find(u => u.id === selectedEmployeeDetails)?.nombre} {users.find(u => u.id === selectedEmployeeDetails)?.apellido}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Periodo de reporte: {filters.fechaInicio ? dayjs(filters.fechaInicio).format('DD MMM, YYYY') : '-'} al {filters.fechaFin ? dayjs(filters.fechaFin).format('DD MMM, YYYY') : '-'}
                  </p>
                </div>
                <div className="min-w-full inline-block align-middle">
                <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Horarios Registrados</th>
                    <th className="px-4 py-3">Hrs Extras</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Observaciones</th>
                    <th className="px-4 py-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {processedAttendances.filter(a => a.usuarioId === selectedEmployeeDetails).map((a) => {
                    const isTarde = a.estado.nombre === 'TARDE';
                    const isFalta = a.estado.nombre === 'AUSENTE';
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-medium text-slate-800">{dayjs.utc(a.fecha).format('DD MMM, YYYY')}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs space-y-1">
                          {a.horaEntrada && <p><span className="text-slate-400">Entrada:</span> <span className="font-medium text-slate-700">{dayjs(a.horaEntrada).format('hh:mm A')}</span></p>}
                          {a.horaSalidaAlmuerzo && <p><span className="text-slate-400">Sale Almz:</span> <span className="font-medium text-slate-700">{dayjs(a.horaSalidaAlmuerzo).format('hh:mm A')}</span></p>}
                          {a.horaEntradaAlmuerzo && <p><span className="text-slate-400">Vuelve Almz:</span> <span className="font-medium text-slate-700">{dayjs(a.horaEntradaAlmuerzo).format('hh:mm A')}</span></p>}
                          {a.horaSalida && <p><span className="text-slate-400">Salida:</span> <span className="font-medium text-slate-700">{dayjs(a.horaSalida).format('hh:mm A')}</span></p>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {a.minutosExtra > 0 ? (
                            <div className="flex flex-col space-y-1">
                              {a.estadoExtras === 'APROBADO' ? (
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-200 w-fit">
                                  Aprobado: {formatMinutes(a.minutosExtraAprobados)}
                                </span>
                              ) : a.estadoExtras === 'RECHAZADO' ? (
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium border bg-red-50 text-red-700 border-red-200 w-fit">
                                  Rechazadas
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-50 text-indigo-700 w-fit" title="Pendiente de aprobación">
                                  Sistema: + {formatMinutes(a.minutosExtra)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium px-2 py-1">
                              0m
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col space-y-2">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border w-fit ${
                              isTarde ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                              isFalta ? 'bg-red-50 text-red-700 border-red-200' : 
                              'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              Mañana: {a.estado.nombre}
                            </span>
                            {a.tardeAlmuerzo && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border w-fit bg-red-50 text-red-700 border-red-200">
                                Tarde de Almuerzo
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 max-w-[300px]">
                          {a.observaciones || <span className="italic text-slate-400">Sin observaciones</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center space-x-2">
                            {a.evidenciaUrl && (
                              <a
                                href={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}${a.evidenciaUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 flex items-center justify-center"
                                title="Ver evidencia adjunta"
                              >
                                <ImageIcon className="w-4 h-4" />
                              </a>
                            )}
                            <button
                              onClick={() => handleDeleteAttendance(a.id)}
                              className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors border border-red-200 flex items-center justify-center"
                              title="Eliminar registro"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalle de Almuerzos por Empleado */}
      {selectedEmployeeLunchDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="text-lg font-bold text-slate-800">
                Historial de Almuerzos
              </h3>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleExportPDFLunchDetalle}
                  disabled={isExportingPDFLunchDetalle}
                  className="inline-flex items-center space-x-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm shadow-rose-200 disabled:opacity-50"
                >
                  <FileText className="w-4 h-4" />
                  <span>{isExportingPDFLunchDetalle ? 'Generando PDF...' : 'Descargar PDF'}</span>
                </button>
                <button
                  onClick={() => setSelectedEmployeeLunchDetails(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto overflow-x-auto p-6 bg-slate-50">
              <div className="min-w-max bg-white rounded-xl shadow-sm border border-slate-100 p-8" ref={reportLunchDetalleRef}>
                <div className="mb-6 pb-4 border-b border-slate-100">
                  <h3 className="text-xl font-bold text-slate-800">
                    Detalle de Almuerzos: {users.find(u => u.id === selectedEmployeeLunchDetails)?.nombre} {users.find(u => u.id === selectedEmployeeLunchDetails)?.apellido}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Periodo de reporte: {filters.fechaInicio ? dayjs(filters.fechaInicio).format('DD MMM, YYYY') : '-'} al {filters.fechaFin ? dayjs(filters.fechaFin).format('DD MMM, YYYY') : '-'}
                  </p>
                </div>
                <div className="min-w-full inline-block align-middle">
                  <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3 text-center">Salida Almuerzo</th>
                      <th className="px-4 py-3 text-center">Regreso Almuerzo</th>
                      <th className="px-4 py-3 text-center">Tiempo Tomado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAttendances.filter(a => a.usuarioId === selectedEmployeeLunchDetails).map(a => {
                      return (
                        <tr key={`lunch-${a.id}`} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-medium text-slate-800">{dayjs.utc(a.fecha).format('DD MMM, YYYY')}</span>
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <span className="text-sm font-medium text-slate-700">{a.horaSalidaAlmuerzo ? dayjs(a.horaSalidaAlmuerzo).format('hh:mm A') : '-'}</span>
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <span className="text-sm font-medium text-slate-700">{a.horaEntradaAlmuerzo ? dayjs(a.horaEntradaAlmuerzo).format('hh:mm A') : '-'}</span>
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {a.horaSalidaAlmuerzo && a.horaEntradaAlmuerzo ? (() => {
                                const salida = dayjs(a.horaSalidaAlmuerzo);
                                const entrada = dayjs(a.horaEntradaAlmuerzo);
                                const diff = entrada.diff(salida, 'minute');
                                const horas = Math.floor(diff / 60);
                                const minutos = diff % 60;
                                return (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border bg-blue-50 text-blue-700 border-blue-200">
                                    {horas > 0 ? `${horas}h ` : ''}{minutos}m
                                  </span>
                                );
                              })() : (
                                <span className="text-xs text-slate-400 italic">-</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {filteredAttendances.filter(a => a.usuarioId === selectedEmployeeLunchDetails).length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-4 py-8 text-center text-slate-500">
                          No hay registros para mostrar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Aprobación de Extras */}
      {approvingExtra && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">
                Aprobar Horas Extras
              </h3>
              <button
                onClick={() => setApprovingExtra(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 bg-white space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Empleado</p>
                <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                  {approvingExtra.usuario.nombre} {approvingExtra.usuario.apellido}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Sugerido (Sistema)</p>
                  <p className="text-sm text-indigo-600 font-bold bg-indigo-50 p-2 rounded border border-indigo-100">
                    {formatMinutes(approvingExtra.minutosExtra)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Aprobar (Minutos)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={extraMinutesToApprove}
                    onChange={(e) => setExtraMinutesToApprove(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 italic mt-2">
                Equivale a: {formatMinutes(Number(extraMinutesToApprove) || 0)}
              </p>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setApprovingExtra(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleRejectExtras}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors shadow-sm"
                >
                  Rechazar
                </button>
                <button
                  type="button"
                  onClick={handleApproveExtras}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors shadow-sm"
                >
                  Aprobar Extras
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ingreso Manual */}
      {manualEntryAttendance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">
                Ingreso Manual
              </h3>
              <button
                onClick={() => setManualEntryAttendance(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleManualEntrySubmit} className="p-6 space-y-4">
              <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-xl border border-blue-100">
                Al ingresar la hora manualmente, el sistema calculará la puntualidad automáticamente basándose en el horario asignado del trabajador.
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Hora de Entrada (Real) *
                  </label>
                  <input
                    type="time"
                    required
                    disabled={!!manualEntryAttendance.latitudEntrada}
                    value={manualEntryTime}
                    onChange={(e) => setManualEntryTime(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Hora de Salida (Opcional)
                  </label>
                  <input
                    type="time"
                    value={manualExitTime}
                    onChange={(e) => setManualExitTime(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setManualEntryAttendance(null)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  Guardar Ingreso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Justificación de Ausentismo */}
      {justifyingAttendance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">
                Justificar Ausentismo
              </h3>
              <button
                onClick={() => setJustifyingAttendance(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleJustifySubmit} className="p-6 space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Empleado</p>
                <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                  {justifyingAttendance.usuario.nombre} {justifyingAttendance.usuario.apellido}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Motivo de la justificación *
                </label>
                <textarea
                  required
                  rows="3"
                  value={justificationText}
                  onChange={(e) => setJustificationText(e.target.value)}
                  placeholder="Ej. Problema médico de última hora, permiso especial..."
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Evidencia Adjunta (Opcional)
                </label>
                {justifyingAttendance.evidenciaUrl && (
                  <div className="mb-3 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                    <p className="text-xs text-emerald-700 font-medium mb-2">✓ Ya existe una evidencia cargada para esta justificación.</p>
                    <a
                      href={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}${justifyingAttendance.evidenciaUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 p-1.5 bg-white text-emerald-600 hover:bg-emerald-100 rounded transition-colors text-xs font-medium border border-emerald-200"
                    >
                      <Download className="w-3 h-3" />
                      <span>Ver/Descargar Evidencia Actual</span>
                    </a>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setJustificationFile(e.target.files[0])}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
                />
                {justifyingAttendance.evidenciaUrl && (
                  <p className="text-xs text-slate-400 mt-1">Si subes un archivo nuevo, reemplazará la evidencia actual.</p>
                )}
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setJustifyingAttendance(null)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingJustification}
                  className="px-4 py-2 bg-yellow-600 text-white font-medium rounded-xl hover:bg-yellow-700 transition-colors shadow-sm disabled:opacity-70"
                >
                  {isSubmittingJustification ? 'Guardando...' : 'Guardar Justificación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
