import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Pencil, Mail, Building2, Briefcase, MapPin, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import ContactForm from "@/components/contact/ContactForm";

export default function Profile() {
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    const contacts = await base44.entities.Contact.list("-created_date", 500);
    const mauro = contacts.find(c => c.name === "Mauro Bertaglia");
    setContact(mauro);
    setLoading(false);
  };

  const handleSaveContact = async (data) => {
    if (contact?.id) {
      await base44.entities.Contact.update(contact.id, data);
    }
    setShowEditForm(false);
    await loadProfile();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-slate-300 font-semibold text-lg">Perfil não encontrado</p>
          <p className="text-slate-500 text-sm">Mauro Bertaglia não está registrado no sistema</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-slate-900 border-b border-slate-800 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="w-32 h-32 rounded-2xl bg-slate-700 border border-slate-600 flex items-center justify-center overflow-hidden flex-shrink-0">
              {contact.photo_url ? (
                <img src={contact.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-5xl font-bold text-slate-300">
                  {contact.name.split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase()}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 pt-2">
              <h1 className="text-4xl font-bold text-white mb-1">{contact.name}</h1>
              {contact.nickname && <p className="text-slate-400 text-lg mb-3">"{contact.nickname}"</p>}
              
              {contact.position && (
                <div className="flex items-center gap-2 text-slate-300 mb-2">
                  <Briefcase className="w-4 h-4" />
                  <span>{contact.position}</span>
                </div>
              )}
              
              {contact.company && (
                <div className="flex items-center gap-2 text-slate-300 mb-2">
                  <Building2 className="w-4 h-4" />
                  <span>{contact.company}</span>
                </div>
              )}

              {contact.city && (
                <div className="flex items-center gap-2 text-slate-300">
                  <MapPin className="w-4 h-4" />
                  <span>{contact.city}{contact.state ? `, ${contact.state}` : ""} {contact.country ? `• ${contact.country}` : ""}</span>
                </div>
              )}

              {/* Edit Button */}
              <Button
                size="sm"
                onClick={() => setShowEditForm(true)}
                className="mt-4 bg-blue-600 hover:bg-blue-700 gap-2"
              >
                <Pencil className="w-4 h-4" />
                Editar Perfil
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Contact Info */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-slate-800">Informações de Contato</h2>
            <div className="space-y-3">
              {contact.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <span className="text-slate-300 text-sm">{contact.email}</span>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 text-sm font-semibold flex-shrink-0">📱</span>
                  <span className="text-slate-300 text-sm">{contact.phone}</span>
                </div>
              )}
              {contact.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300 text-sm">{contact.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Social Links */}
          {(contact.linkedin_url || contact.instagram_url || contact.twitter_url || contact.other_social) && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-slate-800">Redes Sociais</h2>
              <div className="space-y-2">
                {contact.linkedin_url && (
                  <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm">
                    <LinkIcon className="w-4 h-4" />
                    LinkedIn
                  </a>
                )}
                {contact.instagram_url && (
                  <a href={contact.instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-pink-400 hover:text-pink-300 text-sm">
                    <LinkIcon className="w-4 h-4" />
                    Instagram
                  </a>
                )}
                {contact.twitter_url && (
                  <a href={contact.twitter_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sky-400 hover:text-sky-300 text-sm">
                    <LinkIcon className="w-4 h-4" />
                    Twitter
                  </a>
                )}
                {contact.other_social && (
                  <a href={contact.other_social} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-slate-400 hover:text-slate-300 text-sm">
                    <LinkIcon className="w-4 h-4" />
                    Outro
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bio/Notes */}
        {contact.notes && (
          <div className="mt-8 bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <h2 className="text-lg font-semibold text-white mb-3">Sobre</h2>
            <p className="text-slate-300 text-sm leading-relaxed">{contact.notes}</p>
          </div>
        )}

        {/* Tags */}
        {contact.tags && contact.tags.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-white mb-3 pb-2 border-b border-slate-800">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {contact.tags.map(tag => (
                <div key={tag} className="px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-sm">
                  {tag}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit Form Modal */}
      {showEditForm && contact && (
        <ContactForm
          contact={contact}
          contacts={[contact]}
          onSave={handleSaveContact}
          onClose={() => setShowEditForm(false)}
        />
      )}
    </div>
  );
}