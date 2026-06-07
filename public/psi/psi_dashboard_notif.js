/**
 * Arquivo: psi_dashboard_notif.js
 * Responsabilidade: Polling de avisos em background e Notificações de Sessão.
 */

window.carregarAvisosBackground = async function() {
    try {
        const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';
        const apiFetch = window.apiFetch || fetch;
        const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me/announcements?t=${new Date().getTime()}`);
        if (res.ok) {
            const avisos = await res.json();
            const unread = avisos.filter(a => !a.read).length;
            if (window.updateSidebarBadge) {
                window.updateSidebarBadge('psi_avisos.html', unread);
            }
        }
    } catch (error) {
    }
};

window.setupSessionNotifications = function() {
    if (!("Notification" in window)) {
        return;
    }

    const startChecking = () => {
        if (Notification.permission !== "granted") return;

        const checkAppointments = async () => {
            try {
                const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';
                const token = localStorage.getItem('Yelo_token');
                if (!token) return;

                const resAppts = await fetch(`${API_BASE_URL}/api/appointments`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (resAppts.ok) {
                    const allAppts = await resAppts.json();
                    const now = new Date();
                    
                    const upcomingAppts = allAppts.filter(a => {
                        const start = new Date(a.start);
                        return (a.status === 'scheduled' || a.status === 'confirmed') &&
                               start > now;
                    });

                    upcomingAppts.forEach(appt => {
                        const start = new Date(appt.start);
                        const timeUntilStart = start.getTime() - now.getTime();
                        const fifteenMins = 15 * 60 * 1000;

                        if (timeUntilStart > 0 && timeUntilStart <= fifteenMins) { 
                            const notifKey = `notified_appt_${appt.id}`;
                            if (!sessionStorage.getItem(notifKey)) {
                                window.showDesktopNotification(appt);
                                sessionStorage.setItem(notifKey, 'shown');
                            }
                        }
                    });
                }
            } catch (e) {
            }
        };

        checkAppointments();
        if (window.notifInterval) clearInterval(window.notifInterval);
        window.notifInterval = setInterval(checkAppointments, 60000); // Checa a cada 1 minuto
    };

    if (Notification.permission === "default") {
        const requestNotif = async () => {
            try {
                const permission = await Notification.requestPermission();
                document.removeEventListener('click', requestNotif);
                if (permission === "granted") startChecking();
            } catch(e) { }
        };
        document.addEventListener('click', requestNotif);
    } else if (Notification.permission === "granted") {
        startChecking();
    }
};

window.showDesktopNotification = function(appt) {
    if (Notification.permission === "granted") {
        const timeStr = new Date(appt.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const patientName = appt.title || 'Paciente';
        
        try {
            const notification = new Notification("Sessão em 15 minutos ⏰", {
                body: `Sua sessão com ${patientName} começará às ${timeStr}.`,
                icon: '/assets/images/favicon.png'
            });

            notification.onclick = function() {
                window.focus();
                if (typeof window.loadPage === 'function') {
                    window.loadPage('psi_pacientes.html');
                }
                notification.close();
            };
        } catch (e) {
        }
    }
};

window.testarNotificacao = function() {
    if (Notification.permission === "granted") {
        new Notification("Teste de Notificação Yelo ✅", {
            body: "Se você está vendo isso, o sistema de alertas do seu computador está funcionando perfeitamente!",
            icon: '/assets/images/favicon.png'
        });
    }
};

// Configura os intervalos globais
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.carregarAvisosBackground, 2000);
    setInterval(window.carregarAvisosBackground, 60000);
});