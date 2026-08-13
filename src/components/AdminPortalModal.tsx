import React, { useState, useEffect, useRef } from 'react';
import { copyToClipboard } from '../utils/clipboard';
import {
  getDirectGoogleDriveUrl,
  isGoogleDriveUrl,
  fetchDriveFolderImages,
  extractDriveFolderId,
  uploadImageToGoogleDrive,
  saveSiteDataToCloud,
} from '../utils/googleDrive';
import { SafeImage } from './SafeImage';
import {
  X as XIcon,
  ShieldCheck as ShieldCheckIcon,
  DollarSign as DollarSignIcon,
  FileText as FileTextIcon,
  Lock as LockIcon,
  Save as SaveIcon,
  Trash2 as Trash2Icon,
  Plus as PlusIcon,
  Search as SearchIcon,
  Eye as EyeIcon,
  ArrowRight as ArrowRightIcon,
  LogOut as LogOutIcon,
  Image as ImageIcon,
  MapPin as MapPinIcon,
  MessageSquare as MessageSquareIcon,
  Link as LinkIcon,
  CheckCircle as CheckCircleIcon,
  Copy as CopyIcon,
  ExternalLink as ExternalLinkIcon,
  Upload as UploadIcon,
  Edit as EditIcon,
  RefreshCw as RefreshCwIcon,
  Table as TableIcon,
  Folder as FolderIcon,
} from 'lucide-react';

import {
  EventType,
  PackageOption,
  AddOnOption,
  QuoteRecord,
  AdminCredentials,
  GalleryImage,
  FooterContact,
  Testimonial,
} from '../types';

interface AdminPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (title: string, description?: string, type?: 'success' | 'info' | 'warning') => void;
  adminCredentials: AdminCredentials;
  onUpdateAdminCredentials: (creds: AdminCredentials) => void;
  packages: Record<EventType, PackageOption[]>;
  onUpdatePackages: (packages: Record<EventType, PackageOption[]>) => void;
  addons: AddOnOption[];
  onUpdateAddons: (addons: AddOnOption[]) => void;
  onSavePrices?: (packages: Record<EventType, PackageOption[]>, addons: AddOnOption[]) => void;
  quotes: QuoteRecord[];
  onUpdateQuotes: (updater: (prev: QuoteRecord[]) => QuoteRecord[]) => void;
  galleryImages: GalleryImage[];
  onAddGalleryImage: (image: GalleryImage) => void;
  onDeleteGalleryImage: (id: string) => void;
  footerContact: FooterContact;
  onUpdateFooterContact: (contact: FooterContact) => void;
  testimonials: Testimonial[];
  onUpdateTestimonials: (testimonials: Testimonial[]) => void;
}

export const AdminPortalModal: React.FC<AdminPortalModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  adminCredentials,
  onUpdateAdminCredentials,
  packages,
  onUpdatePackages,
  addons,
  onUpdateAddons,
  onSavePrices,
  quotes,
  onUpdateQuotes,
  galleryImages,
  onAddGalleryImage,
  onDeleteGalleryImage,
  footerContact,
  onUpdateFooterContact,
  testimonials,
  onUpdateTestimonials,
}) => {
  // Login State
  const [email, setEmail] = useState('Xavier.garcia.vp@gmail.com');
  const [password, setPassword] = useState('1234');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Active Sub-Tab
  const [activeTab, setActiveTab] = useState<'quotes' | 'prices' | 'gallery' | 'footer' | 'testimonials' | 'security'>('quotes');

  // Quotes Filter
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<'Todos' | 'Pendiente' | 'Cita Presencial Agendada' | 'Contratado'>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<QuoteRecord | null>(null);

  // Editable Packages & Addons local state
  const [editingPackages, setEditingPackages] = useState<Record<EventType, PackageOption[]>>(packages);
  const [editingAddons, setEditingAddons] = useState<AddOnOption[]>(addons);

  // Footer Contact Local State
  const [editingFooter, setEditingFooter] = useState<FooterContact>(footerContact);

  // Security Form local state
  const [newAdminEmail, setNewAdminEmail] = useState(adminCredentials.email);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');

  // Gallery New Photo Form
  const [newPhotoTitle, setNewPhotoTitle] = useState('');
  const [newPhotoCategory, setNewPhotoCategory] = useState<'bodas' | 'xv-anos' | 'bautizos' | 'retratos' | 'empresarial' | 'previa'>('bodas');
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newPhotoLocation, setNewPhotoLocation] = useState('Polanco, CDMX');

  // Google Drive Auto-Sync State
  const [driveFolderUrl, setDriveFolderUrl] = useState('https://drive.google.com/drive/folders/1UyN3m72kG4liDumQYxlO03cKtJJpYG62?usp=sharing');
  const [driveApiKey, setDriveApiKey] = useState(() => {
    return localStorage.getItem('xph_drive_api_key') || (import.meta as any).env?.VITE_GOOGLE_DRIVE_API_KEY || 'AIzaSyAkYYkiVk8qRrKdA8V3a1kGxxeAWMlWLCc';
  });
  const [driveTargetCategory, setDriveTargetCategory] = useState<'auto' | EventType | 'previa'>('auto');
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);

  // Category filter for editing packages without long scrolling
  const [editingCategoryFilter, setEditingCategoryFilter] = useState<EventType | 'addons'>('bodas');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadResultModal, setUploadResultModal] = useState<{
    isOpen: boolean;
    title: string;
    category: string;
    url: string;
    isDrive: boolean;
  } | null>(null);

  const handleApiKeyChange = (val: string) => {
    setDriveApiKey(val);
    localStorage.setItem('xph_drive_api_key', val);
  };

  // File input ref for resetting input after submission
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImageForWeb = (dataUrl: string, maxWidth = 1920, quality = 0.85): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        const rawDataUrl = evt.target.result as string;
        // Instantly populate newPhotoUrl synchronously so publishing is ready immediately
        setNewPhotoUrl(rawDataUrl);

        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        if (!newPhotoTitle) {
          setNewPhotoTitle(cleanName);
        }
        onShowToast('Foto lista para publicar', `Archivo "${file.name}" cargado. Haz clic en Publicar Fotografía.`, 'info');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSyncDriveFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveFolderUrl) {
      onShowToast('Carpeta requerida', 'Ingresa la URL o ID de la carpeta de Google Drive.', 'warning');
      return;
    }
    if (!driveApiKey) {
      onShowToast(
        'Clave de API Requerida',
        'Ingresa tu Google API Key (gratuita en Google Cloud Console) para la sincronización automática.',
        'warning'
      );
      return;
    }

    localStorage.setItem('xph_drive_api_key', driveApiKey);
    setIsSyncingDrive(true);
    try {
      const fetchedImages = await fetchDriveFolderImages(driveFolderUrl, driveApiKey, driveTargetCategory as any);
      if (fetchedImages.length === 0) {
        onShowToast('Sin imágenes', 'No se encontraron archivos de imagen en la carpeta especificada.', 'info');
      } else {
        fetchedImages.forEach((img) => onAddGalleryImage(img));
        onShowToast(
          '¡Sincronización Exitosa!',
          `Se importaron ${fetchedImages.length} fotos automáticamente desde tu Google Drive.`,
          'success'
        );
      }
    } catch (err: any) {
      onShowToast('Error al Sincronizar', err.message || 'Verifica la clave API y la privacidad de la carpeta.', 'warning');
    } finally {
      setIsSyncingDrive(false);
    }
  };

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setEditingPackages(JSON.parse(JSON.stringify(packages)));
      setEditingAddons(JSON.parse(JSON.stringify(addons)));
      setEditingFooter({ ...footerContact });
      setNewAdminEmail(adminCredentials.email);
    }
  }, [isOpen, packages, addons, footerContact, adminCredentials]);

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      email.trim().toLowerCase() === adminCredentials.email.trim().toLowerCase() &&
      password === adminCredentials.pass
    ) {
      setIsLoggedIn(true);
      onShowToast('Sesión de Admin Iniciada', 'Bienvenido al panel de administración de Xavi.Ph.', 'success');
    } else {
      onShowToast(
        'Credenciales Inválidas',
        `Verifica tu usuario (${adminCredentials.email}) y contraseña.`,
        'warning'
      );
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setEmail('');
    setPassword('');
    onShowToast('Sesión Cerrada', 'Has salido del panel de administración.');
  };

  // Quotes management
  const handleUpdateQuoteStatus = (id: string, newStatus: 'Pendiente' | 'Cita Presencial Agendada' | 'Contratado') => {
    onUpdateQuotes((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status: newStatus } : q))
    );
    if (selectedQuote && selectedQuote.id === id) {
      setSelectedQuote((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    onShowToast('Estado Actualizado', `La cotización fue marcada como "${newStatus}".`, 'success');
  };

  const handleDeleteQuote = (id: string) => {
    onUpdateQuotes((prev) => prev.filter((q) => q.id !== id));
    if (selectedQuote && selectedQuote.id === id) {
      setSelectedQuote(null);
    }
    onShowToast('Registro Eliminado', 'La cotización seleccionada fue removida.', 'info');
  };

  // Save Packages and Addons
  const handleSavePrices = () => {
    if (onSavePrices) {
      onSavePrices(editingPackages, editingAddons);
    } else {
      onUpdatePackages(editingPackages);
      onUpdateAddons(editingAddons);
    }
    onShowToast(
      'Cambios Guardados en Vivo',
      'Los paquetes, adiciones y precios se actualizaron y sincronizaron en Google Sheets.',
      'success'
    );
  };

  // Package Field Handlers
  const handlePackageFieldChange = (category: EventType, pkgId: string, field: keyof PackageOption, value: any) => {
    setEditingPackages((prev) => {
      const list = prev[category] || [];
      const updatedList = list.map((p) => (p.id === pkgId ? { ...p, [field]: value } : p));
      return { ...prev, [category]: updatedList };
    });
  };

  const handlePackageFeatureAdd = (category: EventType, pkgId: string) => {
    setEditingPackages((prev) => {
      const list = prev[category] || [];
      const updatedList = list.map((p) =>
        p.id === pkgId ? { ...p, features: [...p.features, 'Nuevo beneficio incluido'] } : p
      );
      return { ...prev, [category]: updatedList };
    });
  };

  const handlePackageFeatureChange = (category: EventType, pkgId: string, index: number, value: string) => {
    setEditingPackages((prev) => {
      const list = prev[category] || [];
      const updatedList = list.map((p) => {
        if (p.id !== pkgId) return p;
        const newFeats = [...p.features];
        newFeats[index] = value;
        return { ...p, features: newFeats };
      });
      return { ...prev, [category]: updatedList };
    });
  };

  const handlePackageFeatureDelete = (category: EventType, pkgId: string, index: number) => {
    setEditingPackages((prev) => {
      const list = prev[category] || [];
      const updatedList = list.map((p) => {
        if (p.id !== pkgId) return p;
        const newFeats = p.features.filter((_, i) => i !== index);
        return { ...p, features: newFeats };
      });
      return { ...prev, [category]: updatedList };
    });
  };

  const handlePackageNotIncludesAdd = (category: EventType, pkgId: string) => {
    setEditingPackages((prev) => {
      const list = prev[category] || [];
      const updatedList = list.map((p) => {
        if (p.id !== pkgId) return p;
        const currentNot = p.notIncludes || [];
        return { ...p, notIncludes: [...currentNot, 'Servicio no incluido'] };
      });
      return { ...prev, [category]: updatedList };
    });
  };

  const handlePackageNotIncludesChange = (category: EventType, pkgId: string, index: number, value: string) => {
    setEditingPackages((prev) => {
      const list = prev[category] || [];
      const updatedList = list.map((p) => {
        if (p.id !== pkgId) return p;
        const currentNot = [...(p.notIncludes || [])];
        currentNot[index] = value;
        return { ...p, notIncludes: currentNot };
      });
      return { ...prev, [category]: updatedList };
    });
  };

  const handlePackageNotIncludesDelete = (category: EventType, pkgId: string, index: number) => {
    setEditingPackages((prev) => {
      const list = prev[category] || [];
      const updatedList = list.map((p) => {
        if (p.id !== pkgId) return p;
        const currentNot = (p.notIncludes || []).filter((_, i) => i !== index);
        return { ...p, notIncludes: currentNot };
      });
      return { ...prev, [category]: updatedList };
    });
  };

  const handleAddPackage = (category: EventType) => {
    const newId = `pkg_${category}_${Date.now()}`;
    const newPkg: PackageOption = {
      id: newId,
      name: 'NUEVO PAQUETE EDITORIAL',
      price: 15000,
      description: 'Descripción del paquete de cobertura.',
      features: ['Cobertura fotográfica profesional', 'Galería web privada HD'],
      notIncludes: ['Horas extra no contempladas'],
    };
    setEditingPackages((prev) => ({
      ...prev,
      [category]: [...(prev[category] || []), newPkg],
    }));
    onShowToast('Paquete Creado', `Se añadió un nuevo paquete a la categoría ${categoryLabels[category]}.`, 'info');
  };

  const handleDeletePackage = (category: EventType, pkgId: string) => {
    setEditingPackages((prev) => ({
      ...prev,
      [category]: (prev[category] || []).filter((p) => p.id !== pkgId),
    }));
    onShowToast('Paquete Eliminado', 'El paquete seleccionado fue removido.', 'info');
  };

  // AddOn Handlers
  const handleAddonFieldChange = (addonId: string, field: keyof AddOnOption, value: any) => {
    setEditingAddons((prev) =>
      prev.map((a) => (a.id === addonId ? { ...a, [field]: value } : a))
    );
  };

  const handleAddonIncludesAdd = (addonId: string) => {
    setEditingAddons((prev) =>
      prev.map((a) => {
        if (a.id !== addonId) return a;
        const currentInc = a.includes || [];
        return { ...a, includes: [...currentInc, 'Detalle de servicio incluido'] };
      })
    );
  };

  const handleAddonIncludesChange = (addonId: string, index: number, value: string) => {
    setEditingAddons((prev) =>
      prev.map((a) => {
        if (a.id !== addonId) return a;
        const currentInc = [...(a.includes || [])];
        currentInc[index] = value;
        return { ...a, includes: currentInc };
      })
    );
  };

  const handleAddonIncludesDelete = (addonId: string, index: number) => {
    setEditingAddons((prev) =>
      prev.map((a) => {
        if (a.id !== addonId) return a;
        const currentInc = (a.includes || []).filter((_, i) => i !== index);
        return { ...a, includes: currentInc };
      })
    );
  };

  const handleAddAddon = () => {
    const newId = `addon_${Date.now()}`;
    const newAddon: AddOnOption = {
      id: newId,
      name: 'Nuevo Servicio Adicional',
      price: 2500,
      description: 'Descripción del servicio adicional.',
      type: 'checkbox',
      includes: ['Detalle incluido en este servicio'],
    };
    setEditingAddons((prev) => [...prev, newAddon]);
    onShowToast('Adicional Agregado', 'Se añadió un servicio adicional al catálogo.', 'info');
  };

  const handleDeleteAddon = (addonId: string) => {
    setEditingAddons((prev) => prev.filter((a) => a.id !== addonId));
    onShowToast('Adicional Eliminado', 'El servicio adicional fue removido.', 'info');
  };

  // Photo Upload Handler
  const handleAddPhotoSubmit = async () => {

    if (!newPhotoUrl) {
      onShowToast('Selecciona una imagen', 'Elige un archivo de foto de tu dispositivo o pega un enlace de imagen.', 'warning');
      return;
    }

    const titleToUse = newPhotoTitle.trim() || `Fotografía ${categoryLabels[newPhotoCategory] || 'CDMX'}`;

    setIsUploadingPhoto(true);
    try {
      let finalPhotoUrl = newPhotoUrl;
      if (newPhotoUrl.startsWith('data:image/')) {
        finalPhotoUrl = await compressImageForWeb(newPhotoUrl);
      }

      // Upload image file directly to Google Drive folder
      const uploadResult = await uploadImageToGoogleDrive(finalPhotoUrl, titleToUse);
      const processedUrl = getDirectGoogleDriveUrl(uploadResult.url);

      const newImg: GalleryImage = {
        id: uploadResult.fileId || `img-${Date.now()}`,
        title: titleToUse,
        category: newPhotoCategory,
        url: processedUrl,
        location: newPhotoLocation || 'Polanco, CDMX',
        camera: 'Sony Alpha 1',
        lens: 'FE 85mm f/1.4 GM',
      };

      onAddGalleryImage(newImg);

      // Clear all form inputs
      setNewPhotoTitle('');
      setNewPhotoUrl('');
      setNewPhotoLocation('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Open persistent result modal window until user clicks OK
      setUploadResultModal({
        isOpen: true,
        title: titleToUse,
        category: categoryLabels[newPhotoCategory] || 'CDMX',
        url: processedUrl,
        isDrive: uploadResult.isDrive,
      });

      onShowToast(
        'Foto cargada correctamente',
        'La imagen fue procesada y publicada en el portafolio.',
        'success'
      );

      // Trigger automatic background sync with Google Drive folder
      if (driveFolderUrl && driveApiKey) {
        fetchDriveFolderImages(driveFolderUrl, driveApiKey, newPhotoCategory)
          .then((syncedImages) => {
            syncedImages.forEach((img) => onAddGalleryImage(img));
          })
          .catch((err) => {
            console.log('Background auto-sync complete', err);
          });
      }
    } catch (err: any) {
      onShowToast('Error al publicar', err.message || 'No se pudo procesar la fotografía.', 'warning');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Force Gallery Sync with Google Sheets
  const [isSyncingSheetsGallery, setIsSyncingSheetsGallery] = useState(false);

  const handleForceSyncGalleryToSheets = async () => {
    setIsSyncingSheetsGallery(true);
    try {
      const cleanImages = galleryImages.filter((img) => !img.url.startsWith('data:image/'));
      await saveSiteDataToCloud(
        { galleryImages: cleanImages },
        'SINCRONIZACION_MANUAL_GALERIA',
        `Sincronización forzada de ${cleanImages.length} fotos con Google Sheets`
      );
      onShowToast(
        'Galería Sincronizada en Google Sheets',
        `Las ${cleanImages.length} fotografías se actualizaron en la tabla Galeria_Fotos del Excel.`,
        'success'
      );
    } catch (err: any) {
      onShowToast('Error al sincronizar', err?.message || 'No se pudo sincronizar.', 'warning');
    } finally {
      setIsSyncingSheetsGallery(false);
    }
  };

  // Footer Save
  const handleSaveFooter = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateFooterContact(editingFooter);
    onShowToast('Pie de Página Actualizado', 'La información de contacto en CDMX se guardó en vivo.', 'success');
  };

  // Testimonial Toggle Verification
  const handleToggleVerifyTestimonial = (id: string) => {
    const updated = testimonials.map((t) => (t.id === id ? { ...t, verified: !t.verified } : t));
    onUpdateTestimonials(updated);
    onShowToast('Testimonio Actualizado', 'Estado de verificación cambiado.', 'info');
  };

  const handleDeleteTestimonial = (id: string) => {
    const updated = testimonials.filter((t) => t.id !== id);
    onUpdateTestimonials(updated);
    onShowToast('Testimonio Removido', 'El comentario fue eliminado.', 'info');
  };

  const handleCopyReviewLink = async () => {
    const link = `${window.location.origin}${window.location.pathname}#testimonios`;
    const success = await copyToClipboard(link);
    if (success) {
      onShowToast('¡Enlace Copiado!', 'Envía este enlace a tus clientes para que dejen su testimonio: ' + link, 'success');
    } else {
      onShowToast('Enlace de Testimonios', link, 'info');
    }
  };

  // Security Save
  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) {
      onShowToast('Correo Requerido', 'Ingresa un correo electrónico válido.', 'warning');
      return;
    }
    if (newAdminPassword && newAdminPassword !== confirmAdminPassword) {
      onShowToast('Contraseñas No Coinciden', 'Asegúrate de que ambas contraseñas sean idénticas.', 'warning');
      return;
    }

    const updatedPass = newAdminPassword.trim() !== '' ? newAdminPassword : adminCredentials.pass;
    onUpdateAdminCredentials({
      email: newAdminEmail.trim(),
      pass: updatedPass,
    });

    setNewAdminPassword('');
    setConfirmAdminPassword('');
    onShowToast('Credenciales Actualizadas', 'Los cambios de acceso se han guardado exitosamente.', 'success');
  };

  // Filtered Quotes
  const filteredQuotes = quotes.filter((q) => {
    const matchesStatus =
      quoteStatusFilter === 'Todos' ? true : q.status === quoteStatusFilter;
    const matchesQuery =
      q.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.clientEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.eventCity.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.packageName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  const categoryLabels: Record<string, string> = {
    bodas: 'Bodas CDMX',
    'xv-anos': 'Quinceañeras (XV)',
    bautizos: 'Bautizos & Familia',
    retratos: 'Retratos & Editorial',
    empresarial: 'Empresarial & Branding',
    previa: 'Sesión Previa',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
      {/* Fullscreen Photo Uploading Loading Screen Overlay */}
      {isUploadingPhoto && (
        <div className="fixed inset-0 z-50 bg-[#0B0F17]/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center space-y-6">
          {/* Animated Gold Glowing Ring Spinner */}
          <div className="relative flex items-center justify-center">
            <div className="w-20 h-20 rounded-full border-4 border-[#D4AF37]/20 border-t-[#D4AF37] animate-spin shadow-2xl shadow-[#D4AF37]/40" />
            <div className="absolute inset-0 flex items-center justify-center text-[#D4AF37]">
              <UploadIcon className="w-8 h-8 animate-bounce" />
            </div>
          </div>

          <div className="space-y-2 max-w-md">
            <h3 className="text-2xl font-bold font-serif-luxury text-white tracking-wide">
              Subiendo Fotografía a Google Drive
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              Procesando optimización HD y guardando la imagen automáticamente en tu carpeta de Google Drive (<code className="text-[#D4AF37] font-mono">1UyN3m72kG4liDum...</code>).
            </p>
          </div>

          {/* Glowing Shimmer Bar */}
          <div className="w-64 h-2.5 rounded-full bg-white/10 overflow-hidden relative border border-white/10">
            <div className="h-full gold-gradient-bg animate-pulse rounded-full w-4/5" />
          </div>

          <p className="text-[11px] font-mono text-[#D4AF37] tracking-wider uppercase animate-pulse">
            ⚡ Sincronizando con el portafolio en tiempo real...
          </p>
        </div>
      )}

      {/* Upload Confirmation Modal Result - Stays open until user clicks OK */}
      {uploadResultModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B0F17]/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="relative max-w-md w-full bg-[#161C28] rounded-3xl border border-[#D4AF37]/50 p-6 sm:p-8 text-center space-y-6 shadow-2xl">
            {/* Header Icon */}
            <div className="w-16 h-16 rounded-full gold-gradient-bg flex items-center justify-center text-black mx-auto shadow-lg shadow-[#D4AF37]/30">
              <CheckCircleIcon className="w-9 h-9" />
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-bold font-serif-luxury text-white">
                Fotografía Procesada
              </h3>
              <p className="text-xs text-gray-300">
                Estatus de publicación y sincronización en tiempo real:
              </p>
            </div>

            {/* Image Thumbnail Preview */}
            <div className="relative rounded-2xl overflow-hidden border border-white/20 shadow-xl max-h-48 flex items-center justify-center bg-black">
              <SafeImage
                src={uploadResultModal.url}
                alt={uploadResultModal.title}
                className="w-full h-48 object-cover"
              />
            </div>

            {/* Status Checklist Box */}
            <div className="p-4 rounded-2xl bg-[#0B0F17] border border-white/10 text-left space-y-2.5 text-xs font-mono">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-gray-400">Título:</span>
                <span className="text-white font-bold truncate max-w-[180px]">{uploadResultModal.title}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-sans">¿Publicado en la Web?</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircleIcon className="w-3.5 h-3.5" />
                  <span>SI (Visible en Portafolio)</span>
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-sans">¿Guardado en Google Drive?</span>
                {uploadResultModal.isDrive ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircleIcon className="w-3.5 h-3.5" />
                    <span>SI (Carpeta Drive OK)</span>
                  </span>
                ) : (
                  <span className="text-amber-400 font-bold flex items-center gap-1">
                    <span>⚠️ Guardado Local (Falta Sync)</span>
                  </span>
                )}
              </div>
            </div>

            {/* OK Button */}
            <button
              onClick={() => setUploadResultModal(null)}
              className="w-full py-3.5 rounded-2xl gold-gradient-bg text-black font-extrabold text-sm uppercase tracking-wider cursor-pointer shadow-xl shadow-[#D4AF37]/20 hover:scale-[1.02] transition-all"
            >
              OK / Entendido
            </button>
          </div>
        </div>
      )}

      <div className="relative w-full max-w-5xl bg-[#161C28] rounded-2xl border border-white/15 p-5 sm:p-8 space-y-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 text-gray-300 hover:text-white hover:bg-white/20 transition-all cursor-pointer z-10"
        >
          <XIcon className="w-5 h-5" />
        </button>

        {!isLoggedIn ? (
          /* LOGIN FORM */
          <div className="max-w-md mx-auto text-center space-y-6 py-8">
            <div className="w-16 h-16 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mx-auto">
              <ShieldCheckIcon className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold font-serif-luxury text-white">
                Acceso Fotógrafo / Administrador
              </h3>
              <p className="text-xs text-gray-300">
                Panel administrativo para gestión de cotizaciones, tarifas, galería y pie de página en tiempo real.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Correo
                </label>
                <input
                  type="email"
                  placeholder="Correo"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0B0F17] border border-white/15 text-white focus:outline-none focus:border-[#D4AF37] text-xs font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Contraseña
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0B0F17] border border-white/15 text-white focus:outline-none focus:border-[#D4AF37] text-xs font-mono"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl gold-gradient-bg text-black font-extrabold text-xs shadow-lg shadow-[#D4AF37]/20 hover:scale-[1.02] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Ingresar al Panel de Control</span>
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          /* AUTHENTICATED BACKOFFICE */
          <div className="space-y-6">
            
            {/* Header Status Bar & Live Preview Button */}
            <div className="border-b border-white/10 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-mono font-bold">
                    PANEL ADMINISTRATIVO XAVI.PH CDMX
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-semibold">
                    ● En Tiempo Real
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold font-serif-luxury text-white">
                  Control de Servicios & Edición en Vivo
                </h3>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <a
                  href={localStorage.getItem('xph_spreadsheet_url') || 'https://docs.google.com/spreadsheets/d/1GavJQKZnn_qtOdc5aaMtqvJg951CccgH1LxuWKhTLAg/edit'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 sm:px-3.5 py-2 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/20 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  title="Abrir base de datos y tablas de registro en Google Sheets"
                >
                  <TableIcon className="w-4 h-4 shrink-0" />
                  <span className="hidden md:inline">Base de Datos (Google Sheets)</span>
                  <span className="md:hidden">Sheets</span>
                </a>

                <button
                  onClick={() => {
                    onClose();
                    onShowToast('Vista en Tiempo Real', 'Explora los cambios realizados en toda la página.', 'info');
                  }}
                  className="px-3 sm:px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <EyeIcon className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Ver Sitio en Tiempo Real</span>
                  <span className="sm:hidden">Ver Sitio</span>
                </button>

                <button
                  onClick={handleLogout}
                  className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <LogOutIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>Salir</span>
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab('quotes')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'quotes'
                    ? 'gold-gradient-bg text-black shadow-md'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <FileTextIcon className="w-3.5 h-3.5" />
                <span>Cotizaciones ({quotes.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('prices')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'prices'
                    ? 'gold-gradient-bg text-black shadow-md'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <DollarSignIcon className="w-3.5 h-3.5" />
                <span>Paquetes & Adicionales</span>
              </button>

              <button
                onClick={() => setActiveTab('gallery')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'gallery'
                    ? 'gold-gradient-bg text-black shadow-md'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Galería de Fotos ({galleryImages.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('testimonials')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'testimonials'
                    ? 'gold-gradient-bg text-black shadow-md'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <MessageSquareIcon className="w-3.5 h-3.5" />
                <span>Testimonios & Enlace ({testimonials.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('footer')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'footer'
                    ? 'gold-gradient-bg text-black shadow-md'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <MapPinIcon className="w-3.5 h-3.5" />
                <span>Contacto Pie de Página</span>
              </button>

              <button
                onClick={() => setActiveTab('security')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'security'
                    ? 'gold-gradient-bg text-black shadow-md'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <LockIcon className="w-3.5 h-3.5" />
                <span>Seguridad</span>
              </button>
            </div>

            {/* TAB 1: COTIZACIONES */}
            {activeTab === 'quotes' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {(['Todos', 'Pendiente', 'Cita Presencial Agendada', 'Contratado'] as const).map(
                      (st) => (
                        <button
                          key={st}
                          onClick={() => setQuoteStatusFilter(st)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                            quoteStatusFilter === st
                              ? 'bg-[#D4AF37] text-black font-bold'
                              : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {st}
                        </button>
                      )
                    )}
                  </div>

                  <div className="relative">
                    <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar cotización..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full sm:w-64 pl-9 pr-4 py-1.5 rounded-xl bg-[#0B0F17] border border-white/15 text-white text-xs focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                {filteredQuotes.length === 0 ? (
                  <div className="text-center py-12 bg-[#0B0F17] rounded-xl border border-white/10 space-y-2">
                    <FileTextIcon className="w-8 h-8 text-gray-500 mx-auto" />
                    <p className="text-sm font-semibold text-gray-300">
                      No hay registros en este filtro.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#0B0F17]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-gray-400 uppercase text-[10px] tracking-wider font-mono bg-white/5">
                          <th className="p-3">Cliente</th>
                          <th className="p-3">Evento & Paquete</th>
                          <th className="p-3">Fecha & Ciudad</th>
                          <th className="p-3">Total</th>
                          <th className="p-3">Estado</th>
                          <th className="p-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredQuotes.map((q) => {
                          const badgeColor =
                            q.status === 'Contratado'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : q.status === 'Cita Presencial Agendada'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/30';

                          return (
                            <tr key={q.id} className="hover:bg-white/5 transition-colors">
                              <td className="p-3">
                                <p className="font-bold text-white">{q.clientName}</p>
                                <p className="text-[10px] text-gray-400">{q.clientEmail}</p>
                                <p className="text-[10px] text-gray-400">{q.clientPhone}</p>
                              </td>

                              <td className="p-3">
                                <p className="font-semibold text-[#D4AF37]">
                                  {categoryLabels[q.eventType]}
                                </p>
                                <p className="text-gray-300">{q.packageName}</p>
                              </td>

                              <td className="p-3">
                                <p className="font-mono text-white">{q.eventDate || 'Por definir'}</p>
                                <p className="text-[10px] text-gray-400">{q.eventCity || 'CDMX'}</p>
                              </td>

                              <td className="p-3 font-mono">
                                <p className="font-bold text-white">${q.total.toLocaleString('es-MX')} MXN</p>
                              </td>

                              <td className="p-3">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${badgeColor}`}>
                                  {q.status}
                                </span>
                              </td>

                              <td className="p-3 text-right space-x-2 whitespace-nowrap">
                                <button
                                  onClick={() => setSelectedQuote(q)}
                                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                                  title="Ver Detalles"
                                >
                                  <EyeIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteQuote(q.id)}
                                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                                  title="Eliminar"
                                >
                                  <Trash2Icon className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: PAQUETES, INCLUYE/NO INCLUYE & ADICIONALES */}
            {activeTab === 'prices' && (
              <div className="space-y-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-[#0B0F17] p-5 rounded-2xl border border-white/10 gap-4">
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-2 font-serif-luxury">
                      <DollarSignIcon className="w-5 h-5 text-[#D4AF37]" />
                      <span>Editar Paquetes (Incluye / No Incluye) & Adicionales</span>
                    </h4>
                    <p className="text-xs text-gray-400 mt-1">
                      Modifica qué incluye y qué no incluye cada paquete. Agrega más de cada uno si es necesario.
                    </p>
                  </div>

                  <button
                    onClick={handleSavePrices}
                    className="px-6 py-3 rounded-xl gold-gradient-bg text-black font-extrabold text-xs shadow-lg shadow-[#D4AF37]/20 hover:scale-105 transition-all cursor-pointer flex items-center gap-2 shrink-0"
                  >
                    <SaveIcon className="w-4 h-4" />
                    <span>Guardar Cambios en Vivo</span>
                  </button>
                </div>

                {/* Sub-menu category selector to avoid long scrolling */}
                <div className="flex flex-wrap items-center gap-2 p-2 rounded-2xl bg-[#0B0F17] border border-white/10">
                  <span className="text-xs font-mono font-bold text-gray-400 px-3 uppercase">Categoría a Editar:</span>
                  {[
                    { id: 'bodas', label: '💍 Bodas CDMX' },
                    { id: 'xv-anos', label: '👑 Quinceañeras (XV)' },
                    { id: 'bautizos', label: '🕊️ Bautizos & Familia' },
                    { id: 'retratos', label: '📸 Retratos & Moda' },
                    { id: 'empresarial', label: '💼 Empresarial' },
                    { id: 'addons', label: '✨ Servicios Adicionales' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setEditingCategoryFilter(tab.id as any)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        editingCategoryFilter === tab.id
                          ? 'gold-gradient-bg text-black font-extrabold shadow-md scale-105'
                          : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Event Type Packages (Rendered dynamically based on selected filter) */}
                {editingCategoryFilter !== 'addons' && (() => {
                  const catKey = editingCategoryFilter as EventType;
                  const catPackages = editingPackages[catKey] || [];
                  return (
                    <div key={catKey} className="p-6 rounded-2xl bg-[#0B0F17] border border-white/10 space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                        <h4 className="text-base font-bold text-[#D4AF37] uppercase tracking-wider font-mono">
                          {categoryLabels[catKey]} ({catPackages.length} paquetes)
                        </h4>

                        <button
                          onClick={() => handleAddPackage(catKey)}
                          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                        >
                          <PlusIcon className="w-3.5 h-3.5 text-[#D4AF37]" />
                          <span>+ Agregar Paquete a {categoryLabels[catKey]}</span>
                        </button>
                      </div>

                      <div className="grid lg:grid-cols-2 gap-6">
                        {catPackages.map((pkg) => (
                          <div key={pkg.id} className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-4">
                            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                              <div className="space-y-1 flex-1">
                                <label className="text-[10px] font-mono text-gray-400 uppercase block">Nombre del Paquete:</label>
                                <input
                                  type="text"
                                  value={pkg.name}
                                  onChange={(e) => handlePackageFieldChange(catKey, pkg.id, 'name', e.target.value)}
                                  className="w-full px-3 py-1.5 rounded-lg bg-[#161C28] border border-white/15 text-white font-bold text-xs"
                                />
                              </div>
                              <button
                                onClick={() => handleDeletePackage(catKey, pkg.id)}
                                className="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 shrink-0 mt-4 cursor-pointer"
                              >
                                <Trash2Icon className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-mono text-gray-400 uppercase block mb-1">Precio Base (MXN):</label>
                                <input
                                  type="number"
                                  value={pkg.price}
                                  onChange={(e) => handlePackageFieldChange(catKey, pkg.id, 'price', Number(e.target.value) || 0)}
                                  className="w-full px-3 py-1.5 rounded-lg bg-[#161C28] border border-white/15 text-white font-mono font-bold text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-mono text-gray-400 uppercase block mb-1">Insignia Badge:</label>
                                <input
                                  type="text"
                                  value={pkg.badge || ''}
                                  onChange={(e) => handlePackageFieldChange(catKey, pkg.id, 'badge', e.target.value)}
                                  className="w-full px-3 py-1.5 rounded-lg bg-[#161C28] border border-white/15 text-white text-xs"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-mono text-gray-400 uppercase block mb-1">Descripción:</label>
                              <textarea
                                rows={2}
                                value={pkg.description}
                                onChange={(e) => handlePackageFieldChange(catKey, pkg.id, 'description', e.target.value)}
                                className="w-full p-2.5 rounded-lg bg-[#161C28] border border-white/15 text-white text-xs"
                              />
                            </div>

                            {/* Features (Qué INCLUYE) */}
                            <div className="space-y-2 pt-2 border-t border-white/10">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-mono font-bold text-[#D4AF37] uppercase">✓ Qué INCLUYE:</span>
                                <button
                                  onClick={() => handlePackageFeatureAdd(catKey, pkg.id)}
                                  className="text-[10px] text-[#D4AF37] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <PlusIcon className="w-3 h-3" />
                                  <span>Agregar Incluye</span>
                                </button>
                              </div>
                              <div className="space-y-2">
                                {pkg.features.map((feat, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={feat}
                                      onChange={(e) => handlePackageFeatureChange(catKey, pkg.id, idx, e.target.value)}
                                      className="flex-1 px-3 py-1 rounded-lg bg-[#161C28] border border-white/10 text-white text-xs"
                                    />
                                    <button
                                      onClick={() => handlePackageFeatureDelete(catKey, pkg.id, idx)}
                                      className="p-1 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                                    >
                                      <XIcon className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Exclusions (Qué NO INCLUYE) */}
                            <div className="space-y-2 pt-2 border-t border-white/10">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-mono font-bold text-rose-400 uppercase">✕ Qué NO INCLUYE:</span>
                                <button
                                  onClick={() => handlePackageNotIncludesAdd(catKey, pkg.id)}
                                  className="text-[10px] text-rose-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <PlusIcon className="w-3 h-3" />
                                  <span>Agregar No Incluye</span>
                                </button>
                              </div>
                              <div className="space-y-2">
                                {(pkg.notIncludes || []).map((notInc, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={notInc}
                                      onChange={(e) => handlePackageNotIncludesChange(catKey, pkg.id, idx, e.target.value)}
                                      className="flex-1 px-3 py-1 rounded-lg bg-[#161C28] border border-white/10 text-white text-xs"
                                    />
                                    <button
                                      onClick={() => handlePackageNotIncludesDelete(catKey, pkg.id, idx)}
                                      className="p-1 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                                    >
                                      <XIcon className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>

                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Addons Catalog Editor */}
                {editingCategoryFilter === 'addons' && (
                  <div className="p-6 rounded-2xl bg-[#0B0F17] border border-white/10 space-y-6">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <h4 className="text-base font-bold text-[#D4AF37] uppercase font-mono">Servicios Adicionales (Add-Ons)</h4>
                      <button
                        onClick={handleAddAddon}
                        className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                      >
                        <PlusIcon className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>+ Agregar Servicio Adicional</span>
                      </button>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-6">
                      {editingAddons.map((addon) => (
                        <div key={addon.id} className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-3">
                          <div className="flex justify-between items-center">
                            <input
                              type="text"
                              value={addon.name}
                              onChange={(e) => handleAddonFieldChange(addon.id, 'name', e.target.value)}
                              className="font-bold text-white bg-[#161C28] px-3 py-1 rounded-lg text-xs border border-white/15 w-2/3"
                            />
                            <button onClick={() => handleDeleteAddon(addon.id)} className="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg cursor-pointer">
                              <Trash2Icon className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex gap-3">
                            <input
                              type="number"
                              value={addon.price}
                              onChange={(e) => handleAddonFieldChange(addon.id, 'price', Number(e.target.value) || 0)}
                              className="font-mono text-white bg-[#161C28] px-3 py-1 rounded-lg text-xs border border-white/15 w-1/2"
                            />
                            <span className="text-xs text-gray-400 my-auto">MXN</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: GALERÍA & SUBIR FOTOS */}
            {activeTab === 'gallery' && (
              <div className="space-y-6">
                {/* Google Sheets Database & Cloud Controls */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#161C28] via-[#1A2232] to-[#161C28] border border-[#D4AF37]/50 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <TableIcon className="w-5 h-5 text-[#D4AF37]" />
                      <h4 className="text-sm sm:text-base font-bold text-white font-serif-luxury">
                        Base de Datos de Fotografías & Historial Cloud
                      </h4>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-mono font-bold border border-emerald-500/30">
                        {galleryImages.length} Fotos Activas
                      </span>
                    </div>
                    <p className="text-xs text-gray-300">
                      Gestiona, valida y audita cada fotografía registrada en tiempo real en la tabla <code className="text-[#D4AF37]">Galeria_Fotos</code> de Google Sheets.
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
                    <button
                      type="button"
                      disabled={isSyncingSheetsGallery}
                      onClick={handleForceSyncGalleryToSheets}
                      className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl gold-gradient-bg text-black font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#D4AF37]/20 hover:scale-105 transition-all disabled:opacity-50"
                      title="Guardar y sincronizar todas las fotos actuales en Google Sheets"
                    >
                      <SaveIcon className={`w-3.5 h-3.5 ${isSyncingSheetsGallery ? 'animate-spin' : ''}`} />
                      <span>{isSyncingSheetsGallery ? 'Sincronizando...' : '💾 Guardar en Google Sheets'}</span>
                    </button>

                    <a
                      href={localStorage.getItem('xph_spreadsheet_url') || 'https://docs.google.com/spreadsheets/d/1GavJQKZnn_qtOdc5aaMtqvJg951CccgH1LxuWKhTLAg/edit'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/20 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                      title="Abrir tabla Galeria_Fotos en Google Sheets"
                    >
                      <TableIcon className="w-4 h-4 shrink-0" />
                      <span>Ver en Google Sheets</span>
                    </a>

                    <a
                      href="https://drive.google.com/drive/folders/1UyN3m72kG4liDumQYxlO03cKtJJpYG62"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/15 text-gray-300 hover:text-white hover:bg-white/10 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      title="Abrir carpeta en Google Drive"
                    >
                      <FolderIcon className="w-4 h-4 shrink-0 text-[#D4AF37]" />
                      <span className="hidden md:inline">Google Drive</span>
                    </a>
                  </div>
                </div>

                {/* Google Drive Folder Automatic Sync Card */}
                <div className="p-6 rounded-2xl bg-[#0B0F17] border border-white/10 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                    <div>
                      <h4 className="text-base font-bold text-white font-serif-luxury flex items-center gap-2">
                        <RefreshCwIcon className="w-5 h-5 text-[#D4AF37]" />
                        <span>Sincronizar Fotos desde tu Carpeta de Google Drive</span>
                      </h4>
                      <p className="text-xs text-gray-300 mt-1">
                        Carpeta configurada: <code className="text-[#D4AF37]">1UyN3m72kG4liDumQYxlO03cKtJJpYG62</code>
                      </p>
                    </div>

                    <span className="px-2.5 py-1 rounded bg-[#D4AF37]/20 text-[#D4AF37] text-[10px] font-mono font-bold border border-[#D4AF37]/40">
                      CONEXIÓN DIRECTA OK
                    </span>
                  </div>

                  <form onSubmit={handleSyncDriveFolder} className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <label className="text-gray-300 font-semibold whitespace-nowrap">Asignar a Categoría:</label>
                      <select
                        value={driveTargetCategory}
                        onChange={(e) => setDriveTargetCategory(e.target.value as any)}
                        className="px-3 py-2 rounded-xl bg-[#0B0F17] border border-white/15 text-white text-xs cursor-pointer"
                      >
                        <option value="auto">⚡ Auto-detectar por nombre</option>
                        <option value="bodas">💍 Bodas CDMX</option>
                        <option value="xv-anos">👑 XV Años</option>
                        <option value="bautizos">🕊️ Bautizos & Familia</option>
                        <option value="retratos">📸 Retratos & Moda</option>
                        <option value="empresarial">💼 Empresarial & Branding</option>
                        <option value="previa">✨ Sesión Previa</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={isSyncingDrive}
                      className="w-full sm:w-auto px-8 py-3 rounded-xl gold-gradient-bg text-black font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#D4AF37]/20 hover:scale-105 transition-all disabled:opacity-50 text-xs"
                    >
                      <RefreshCwIcon className={`w-4 h-4 ${isSyncingDrive ? 'animate-spin' : ''}`} />
                      <span>{isSyncingDrive ? 'Sincronizando...' : '🔄 Sincronizar Galería desde Google Drive'}</span>
                    </button>
                  </form>
                </div>

                <div className="p-6 rounded-2xl bg-[#0B0F17] border border-white/10 space-y-4">
                  <h4 className="text-base font-bold text-white font-serif-luxury flex items-center gap-2">
                    <UploadIcon className="w-5 h-5 text-[#D4AF37]" />
                    <span>Agregar Nueva Fotografía a la Galería (CDMX)</span>
                  </h4>

                  <div className="grid sm:grid-cols-2 gap-4 text-xs">
                    <div className="sm:col-span-2 p-3.5 rounded-xl bg-white/5 border border-dashed border-[#D4AF37]/40 space-y-2">
                      <label htmlFor="localFileInput" className="text-gray-200 block font-bold text-xs flex items-center gap-2">
                        <UploadIcon className="w-4 h-4 text-[#D4AF37]" />
                        <span>Seleccionar Archivo de Foto Local (PC / Celular)</span>
                      </label>
                      <input
                        ref={fileInputRef}
                        id="localFileInput"
                        name="localFile"
                        type="file"
                        accept="image/*"
                        onChange={handleLocalFileSelect}
                        className="w-full text-xs text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:gold-gradient-bg file:text-black hover:file:opacity-90 cursor-pointer"
                      />
                      <p className="text-[10px] text-gray-400">
                        📁 Selecciona una foto desde tu dispositivo o pega un enlace de Google Drive / Unsplash abajo.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="newPhotoTitleInput" className="text-gray-300 block mb-1">Título de la Fotografía</label>
                      <input
                        id="newPhotoTitleInput"
                        name="photoTitle"
                        type="text"
                        placeholder="Ej. Boda Editorial en Polanco"
                        value={newPhotoTitle}
                        onChange={(e) => setNewPhotoTitle(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#161C28] border border-white/15 text-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="newPhotoCategorySelect" className="text-gray-300 block mb-1">Categoría</label>
                      <select
                        id="newPhotoCategorySelect"
                        name="photoCategory"
                        value={newPhotoCategory}
                        onChange={(e) => setNewPhotoCategory(e.target.value as any)}
                        className="w-full px-3 py-2.5 rounded-xl bg-[#161C28] border border-white/15 text-white"
                      >
                        <option value="bodas">Bodas CDMX</option>
                        <option value="xv-anos">XV Años</option>
                        <option value="bautizos">Bautizos & Familia</option>
                        <option value="retratos">Retratos & Moda</option>
                        <option value="empresarial">Empresarial & Branding</option>
                        <option value="previa">Sesión Previa</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="newPhotoUrlInput" className="text-gray-300 block font-medium">URL o Enlace de la Imagen (Unsplash, Google Drive, etc.)</label>
                        {isGoogleDriveUrl(newPhotoUrl) && (
                          <span className="text-[10px] font-mono text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-0.5 rounded border border-[#D4AF37]/30">
                            ✨ Enlace de Google Drive Detectado
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        id="newPhotoUrlInput"
                        name="newPhotoUrl"
                        placeholder="Pegar enlace de Google Drive o URL directa de la foto"
                        value={newPhotoUrl}
                        onChange={(e) => setNewPhotoUrl(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#161C28] border border-white/15 text-white text-xs font-mono"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">
                        💡 Puedes seleccionar un archivo arriba o pegar enlaces compartidos de Google Drive (<code className="text-[#D4AF37]">https://drive.google.com/file/d/...</code>).
                      </p>
                    </div>

                    <div>
                      <label htmlFor="newPhotoLocationInput" className="text-gray-300 block mb-1">Ubicación / Locación (CDMX)</label>
                      <input
                        id="newPhotoLocationInput"
                        name="photoLocation"
                        type="text"
                        placeholder="Ej. Hacienda de los Morales, CDMX"
                        value={newPhotoLocation}
                        onChange={(e) => setNewPhotoLocation(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#161C28] border border-white/15 text-white"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        disabled={isUploadingPhoto}
                        onClick={handleAddPhotoSubmit}
                        className="w-full py-2.5 rounded-xl gold-gradient-bg text-black font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 hover:scale-[1.02] transition-all"
                      >
                        <PlusIcon className={`w-4 h-4 ${isUploadingPhoto ? 'animate-spin' : ''}`} />
                        <span>{isUploadingPhoto ? 'Subiendo a Google Drive y Publicando...' : '+ Publicar Fotografía'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      Fotografías en Portafolio ({galleryImages.length})
                    </h5>
                    <button
                      type="button"
                      disabled={isSyncingSheetsGallery}
                      onClick={handleForceSyncGalleryToSheets}
                      className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <SaveIcon className="w-3 h-3" />
                      <span>Sincronizar tabla Excel</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {galleryImages.map((img) => (
                      <div key={img.id} className="relative group rounded-xl overflow-hidden border border-white/10 bg-[#0B0F17]">
                        <SafeImage src={img.url} alt={img.title} className="w-full h-32 object-cover" />
                        <div className="p-2 space-y-1">
                          <p className="text-xs font-bold text-white truncate">{img.title}</p>
                          <span className="text-[10px] text-[#D4AF37] uppercase block">{img.category}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteGalleryImage(img.id);
                            onShowToast('Foto Eliminada', 'La imagen fue removida de la galería permanentemente.', 'success');
                          }}
                          className="absolute top-2 right-2 p-1.5 sm:p-2 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white shadow-lg transition-all cursor-pointer z-10 opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
                          title="Eliminar foto de la galería"
                        >
                          <Trash2Icon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: TESTIMONIOS & ENLACE DE CLIENTES */}
            {activeTab === 'testimonials' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between bg-[#0B0F17] p-5 rounded-2xl border border-white/10">
                  <div>
                    <h4 className="text-base font-bold text-white font-serif-luxury">Gestor de Comentarios & Generador de Enlace</h4>
                    <p className="text-xs text-gray-400 mt-1">Comparte este enlace a tus clientes para que califiquen el servicio.</p>
                  </div>
                  <button
                    onClick={handleCopyReviewLink}
                    className="px-5 py-2.5 rounded-xl gold-gradient-bg text-black font-extrabold text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <CopyIcon className="w-4 h-4" />
                    <span>Copiar Enlace de Reseña</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {testimonials.map((t) => (
                    <div key={t.id} className="p-4 rounded-xl bg-[#0B0F17] border border-white/10 flex items-center justify-between gap-4 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{t.clientName}</span>
                          <span className="text-[#D4AF37]">★ {t.rating}/5</span>
                          {t.verified && <span className="text-emerald-400 text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded font-mono">Verificado</span>}
                        </div>
                        <p className="text-gray-300 italic mt-1 font-serif-luxury">"{t.comment}"</p>
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleToggleVerifyTestimonial(t.id)}
                          className="px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 text-xs font-semibold"
                        >
                          {t.verified ? 'Desverificar' : 'Verificar'}
                        </button>
                        <button
                          onClick={() => handleDeleteTestimonial(t.id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                        >
                          <Trash2Icon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: CONTACTO EN PIE DE PÁGINA (FOOTER) */}
            {activeTab === 'footer' && (
              <div className="p-6 rounded-2xl bg-[#0B0F17] border border-white/10 space-y-4">
                <h4 className="text-base font-bold text-white font-serif-luxury flex items-center gap-2">
                  <MapPinIcon className="w-5 h-5 text-[#D4AF37]" />
                  <span>Editar Información del Pie de Página (CDMX)</span>
                </h4>

                <form onSubmit={handleSaveFooter} className="space-y-4 text-xs">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-gray-300 block mb-1">Teléfono Principal</label>
                      <input
                        type="text"
                        value={editingFooter.phone}
                        onChange={(e) => setEditingFooter({ ...editingFooter, phone: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#161C28] border border-white/15 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-gray-300 block mb-1">Correo de Contacto</label>
                      <input
                        type="email"
                        value={editingFooter.email}
                        onChange={(e) => setEditingFooter({ ...editingFooter, email: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#161C28] border border-white/15 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-gray-300 block mb-1">Dirección & Cobertura en CDMX</label>
                    <input
                      type="text"
                      value={editingFooter.address}
                      onChange={(e) => setEditingFooter({ ...editingFooter, address: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#161C28] border border-white/15 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-gray-300 block mb-1">Horario de Atención</label>
                    <input
                      type="text"
                      value={editingFooter.schedule}
                      onChange={(e) => setEditingFooter({ ...editingFooter, schedule: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#161C28] border border-white/15 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-gray-300 block mb-1">Texto Breve Sobre el Estudio</label>
                    <textarea
                      rows={3}
                      value={editingFooter.aboutText}
                      onChange={(e) => setEditingFooter({ ...editingFooter, aboutText: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#161C28] border border-white/15 text-white"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-xl gold-gradient-bg text-black font-extrabold flex items-center gap-2 shadow-lg shadow-[#D4AF37]/20"
                    >
                      <SaveIcon className="w-4 h-4" />
                      <span>Guardar Pie de Página</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 6: SEGURIDAD */}
            {activeTab === 'security' && (
              <div className="p-6 rounded-2xl bg-[#0B0F17] border border-white/10 space-y-4">
                <h4 className="text-base font-bold text-white font-serif-luxury flex items-center gap-2">
                  <LockIcon className="w-5 h-5 text-[#D4AF37]" />
                  <span>Seguridad & Credenciales de Administrador</span>
                </h4>

                <form onSubmit={handleSaveSecurity} className="space-y-4 text-xs max-w-md">
                  <div>
                    <label className="text-gray-300 block mb-1">Correo Electrónico de Admin</label>
                    <input
                      type="email"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#161C28] border border-white/15 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-gray-300 block mb-1">Nueva Contraseña (Opcional)</label>
                    <input
                      type="password"
                      placeholder="Dejar en blanco para conservar actual"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#161C28] border border-white/15 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-gray-300 block mb-1">Confirmar Nueva Contraseña</label>
                    <input
                      type="password"
                      placeholder="Confirmar contraseña"
                      value={confirmAdminPassword}
                      onChange={(e) => setConfirmAdminPassword(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#161C28] border border-white/15 text-white font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl gold-gradient-bg text-black font-extrabold flex items-center gap-2"
                  >
                    <SaveIcon className="w-4 h-4" />
                    <span>Actualizar Credenciales</span>
                  </button>
                </form>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
};
