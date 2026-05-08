import React, { useEffect, useMemo, useState } from 'react';

const API_URL =
  'https://script.google.com/macros/s/AKfycbyaN7w176IOfHqY3n21NZmvHIVK1fChGzG3Z07MhIK0GXvIw0Vd_fsrTtZd7bARS1_JTw/exec';

const MAX_PER_DAY = 4;
const ADMIN_KEY = 'DOSMOOVADMIN';
const LOGO_URL = '/dos_logo_v2.png';
const REGISTER_URL = 'https://dos-moov-fitness.vercel.app/';

type Booking = {
  id: string;
  user: string;
  date: string;
  time: string;
  className: string;
  createdAt?: string;
};

type ScheduleItem = {
  id: string;
  month: string;
  day: string;
  date: string;
  time: string;
  className: string;
  instructor: string;
  studio: string;
  active: boolean;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

const toYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const todayYMD = () => toYMD(new Date());

const normalize = (s: string) => String(s || '').trim().toLowerCase();

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const isTomorrowOrLater = (date: string) => {
  if (!date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const min = new Date(today);
  min.setDate(min.getDate() + 1);

  const d = new Date(`${date}T00:00:00`);
  return d >= min;
};

const formatDateTH = (ymd: string) => {
  if (!ymd) return '-';

  const d = new Date(`${ymd}T00:00:00`);
  return d.toLocaleDateString('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

const formatDateFullTH = (ymd: string) => {
  if (!ymd) return '-';

  const d = new Date(`${ymd}T00:00:00`);
  return d.toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export default function App() {
  const [user, setUser] = useState('');
  const [loginInput, setLoginInput] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedClass, setSelectedClass] = useState<ScheduleItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [adminMode, setAdminMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('dos_moov_user');
    if (saved) setUser(saved);
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAll = async () => {
    setLoading(true);
    setMsg('');

    try {
      const cacheBust = Date.now();
      const [bookingRes, scheduleRes] = await Promise.all([
        fetch(`${API_URL}?action=getAll&v=${cacheBust}`),
        fetch(`${API_URL}?action=getSchedule&v=${cacheBust}`),
      ]);

      const bookingJson = (await bookingRes.json()) as ApiResponse<Booking[]>;
      const scheduleJson = (await scheduleRes.json()) as ApiResponse<ScheduleItem[]>;

      if (bookingJson.success) {
        setBookings(bookingJson.data || []);
      } else {
        setMsg(`❌ โหลดรายการจองไม่สำเร็จ: ${bookingJson.error || 'Unknown error'}`);
      }

      if (scheduleJson.success) {
        const active = (scheduleJson.data || [])
          .filter((s) => s.active && isTomorrowOrLater(s.date))
          .sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.time.localeCompare(b.time);
          });

        setSchedule(active);

        if (active.length > 0) {
          setSelectedDate((current) => {
            if (current && active.some((s) => s.date === current)) return current;
            return active[0].date;
          });
        } else {
          setSelectedDate('');
          setSelectedClass(null);
        }
      } else {
        setMsg(`❌ โหลดตารางคลาสไม่สำเร็จ: ${scheduleJson.error || 'Unknown error'}`);
      }
    } catch (error) {
      setMsg('❌ โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  const dates = useMemo(() => {
    const unique = [...new Set(schedule.map((s) => s.date).filter(Boolean))];
    return unique.sort();
  }, [schedule]);

  const classesForDate = useMemo(() => {
    return schedule.filter((s) => s.date === selectedDate);
  }, [schedule, selectedDate]);

  const bookingsForDate = useMemo(() => {
    return bookings
      .filter((b) => b.date === selectedDate)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [bookings, selectedDate]);

  const uniqueUsersForDate = useMemo(() => {
    return [...new Set(bookingsForDate.map((b) => normalize(b.user)))].filter(Boolean);
  }, [bookingsForDate]);

  const capacityUsed = uniqueUsersForDate.length;
  const occupancy = Math.round((capacityUsed / MAX_PER_DAY) * 100);

  const currentUserBookingsToday = useMemo(() => {
    return bookingsForDate.filter((b) => normalize(b.user) === normalize(user));
  }, [bookingsForDate, user]);

  const userBookedTimes = useMemo(() => {
    return currentUserBookingsToday.map((b) => b.time);
  }, [currentUserBookingsToday]);

  const isCurrentUserCountedToday = useMemo(() => {
    return uniqueUsersForDate.includes(normalize(user));
  }, [uniqueUsersForDate, user]);

  const remaining = Math.max(0, MAX_PER_DAY - capacityUsed);
  const isDayFullForNewUser = capacityUsed >= MAX_PER_DAY && !isCurrentUserCountedToday;

  const handleLogin = () => {
    const name = loginInput.trim();
    if (!name) {
      setMsg('กรุณาพิมพ์ชื่อก่อนเข้าสู่ระบบ');
      return;
    }

    localStorage.setItem('dos_moov_user', name);
    setUser(name);
    setLoginInput('');
    setMsg('');
  };

  const logout = () => {
    localStorage.removeItem('dos_moov_user');
    setUser('');
    setLoginInput('');
    setSelectedClass(null);
    setMsg('');
  };

  const bookClass = async () => {
    if (!user) return;

    if (!selectedClass) {
      setMsg('กรุณาเลือกคลาสก่อน');
      return;
    }

    if (userBookedTimes.includes(selectedClass.time)) {
      setMsg('❌ คุณจองเวลาเดิมในวันเดียวกันซ้ำไม่ได้');
      return;
    }

    if (isDayFullForNewUser) {
      setMsg('❌ วันนี้เต็มแล้ว');
      return;
    }

    setLoading(true);
    setMsg('');

    const params = new URLSearchParams({
      action: 'add',
      id: uid(),
      user,
      date: selectedClass.date,
      time: selectedClass.time,
      className: selectedClass.className,
    });

    try {
      const res = await fetch(`${API_URL}?${params.toString()}`);
      const json = (await res.json()) as ApiResponse<Booking>;

      if (json.success) {
        setMsg('✅ ลงทะเบียนสำเร็จ');
        setSelectedClass(null);
        await loadAll();
      } else {
        setMsg(`❌ ${json.error || 'เกิดข้อผิดพลาด'}`);
      }
    } catch (error) {
      setMsg('❌ เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  const loginAdmin = () => {
    if (adminKeyInput.trim() === ADMIN_KEY) {
      setAdminMode(true);
      setAdminKeyInput('');
      setMsg('');
    } else {
      alert('❌ Admin Key ไม่ถูกต้อง');
    }
  };

  const exportCSV = () => {
    const headers = ['id', 'user', 'date', 'time', 'className', 'createdAt'];
    const rows = bookings.map((b) =>
      headers
        .map((h) => `"${String((b as any)[h] || '').replace(/"/g, '""')}"`)
        .join(',')
    );

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dos-moov-bookings-${todayYMD()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const topSlots = useMemo(() => {
    const map: Record<string, number> = {};
    bookings.forEach((b) => {
      const key = `${b.date} ${b.time} ${b.className}`;
      map[key] = (map[key] || 0) + 1;
    });

    return Object.entries(map)
      .map(([slot, count]) => ({ slot, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [bookings]);

  const topUsers = useMemo(() => {
    const map: Record<string, number> = {};
    bookings.forEach((b) => {
      const key = b.user || 'Unknown';
      map[key] = (map[key] || 0) + 1;
    });

    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [bookings]);

  if (!user) {
    return (
      <div style={styles.app}>
        <div style={styles.loginWrap}>
          <div style={styles.heroCard}>
            <div style={styles.loginHeader}>
              <img src={LOGO_URL} alt="DOS Logo" style={styles.logo} />
              <div>
                <h1 style={styles.heroTitle}>DOS x MOOV Fitness</h1>
                <p style={styles.heroSub}>ลงทะเบียนออกกำลังกายแบบง่าย เร็ว และดูดี</p>
              </div>
            </div>

            <div style={styles.loginCard}>
              <h2 style={styles.loginTitle}>เข้าสู่ระบบ</h2>
              <p style={styles.loginDesc}>โปรดใช้ชื่อเดิมทุกครั้ง เพื่อให้ระบบนับสิทธิ์ได้ถูกต้อง</p>

              <input
                style={styles.inputCenter}
                placeholder="พิมพ์ชื่อของคุณ..."
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />

              {msg && <div style={styles.message}>{msg}</div>}

              <button style={styles.btnAccentFull} onClick={handleLogin}>
                🔑 เข้าสู่ระบบ
              </button>

              <div style={styles.loginStats}>
                <MiniStat label="Capacity / วัน" value={MAX_PER_DAY} />
                <MiniStat label="Booking Rule" value="T+1" />
                <MiniStat label="Status" value="Online" green />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <div style={styles.container}>
        <div style={styles.topbar}>
          <div style={styles.brand}>
            <img src={LOGO_URL} alt="DOS Logo" style={styles.logoSmall} />
            <div>
              <h1 style={styles.title}>DOS x MOOV Fitness</h1>
              <div style={styles.sub}>สวัสดี, {user}</div>
            </div>
          </div>

          <div style={styles.topActions}>
            <span style={styles.online}>🟢 Online</span>
            <button onClick={loadAll} style={styles.btnGhost} disabled={loading}>
              {loading ? 'กำลังโหลด...' : 'รีเฟรช'}
            </button>
            <button onClick={logout} style={styles.btnGhost}>
              ออก
            </button>
          </div>
        </div>

        <div style={styles.noticeCard}>
          <strong>Booking Rule:</strong> จองได้ตั้งแต่วันถัดไป (T+1) · จำกัด {MAX_PER_DAY} คนต่อวัน · คนเดิมจองได้หลายคลาส แต่ห้ามจองเวลาเดิมซ้ำ
        </div>

        <div style={styles.statsGrid}>
          <StatCard label="ยอดจองวันที่เลือก" value={capacityUsed} />
          <StatCard label="Capacity" value={`${capacityUsed}/${MAX_PER_DAY}`} />
          <StatCard label="Occupancy" value={`${occupancy}%`} />
          <StatCard label="คงเหลือ" value={remaining} />
        </div>

        <div style={styles.flowGrid}>
          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>1. เลือกวันที่</h2>
            <p style={styles.sectionSub}>ระบบแสดงเฉพาะวันที่เปิดคลาส และเริ่มจองได้ตั้งแต่วันถัดไป (T+1)</p>

            <div style={styles.dateGrid}>
              {dates.length === 0 ? (
                <div style={styles.empty}>ยังไม่มีตารางคลาสที่เปิดให้จอง</div>
              ) : (
                dates.map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setSelectedDate(d);
                      setSelectedClass(null);
                      setMsg('');
                    }}
                    style={{
                      ...styles.dateBtn,
                      ...(selectedDate === d ? styles.dateBtnActive : {}),
                    }}
                  >
                    <div>{formatDateTH(d)}</div>
                    <strong>{d.slice(5)}</strong>
                  </button>
                ))
              )}
            </div>
          </section>



          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>2. เลือกเวลา</h2>
            <p style={styles.sectionSub}>จองวันเดิมซ้ำได้ แต่ห้ามจองเวลาเดิมซ้ำในวันเดียวกัน</p>

            {isDayFullForNewUser && <div style={styles.warnBox}>วันนี้เต็มแล้วสำหรับผู้จองใหม่</div>}

            <div style={styles.timeGrid}>
              {classesForDate.length === 0 ? (
                <div style={styles.empty}>ไม่มีเวลาให้เลือก</div>
              ) : (
                classesForDate.map((c) => {
                  const isBookedSameTime = userBookedTimes.includes(c.time);
                  const active = selectedClass?.id === c.id;

                  return (
                    <button
                      key={c.id}
                      disabled={isBookedSameTime || isDayFullForNewUser}
                      onClick={() => {
                        setSelectedClass(c);
                        setMsg('');
                      }}
                      style={{
                        ...styles.timeBtn,
                        ...(active ? styles.timeBtnActive : {}),
                        ...(isBookedSameTime || isDayFullForNewUser ? styles.timeBtnDisabled : {}),
                      }}
                    >
                      <div style={styles.timeText}>⏰ {c.time}</div>
                      <div>{c.className}</div>
                      <small>
                        {c.instructor || '-'} · {c.studio || '-'}
                      </small>
                      {isBookedSameTime && <div style={styles.badge}>จองแล้ว</div>}
                    </button>
                  );
                })
              )}
            </div>

            {msg && <div style={styles.message}>{msg}</div>}

            <button
              onClick={bookClass}
              disabled={loading || !selectedClass || isDayFullForNewUser}
              style={{
                ...styles.btnPrimary,
                opacity: loading || !selectedClass || isDayFullForNewUser ? 0.55 : 1,
              }}
            >
              {loading ? 'กำลังบันทึก...' : '✅ ลงทะเบียน'}
            </button>
          </section>

          <section style={styles.card}>
            <h2 style={{ ...styles.sectionTitle, textAlign: 'left' }}>3. รายชื่อผู้ลงทะเบียน</h2>
            <p style={{ ...styles.sectionSub, textAlign: 'left' }}>
              วันที่ {selectedDate || '-'} · {capacityUsed}/{MAX_PER_DAY}
            </p>

            <div style={styles.list}>
              {bookingsForDate.length === 0 ? (
                <div style={styles.empty}>ยังไม่มีผู้ลงทะเบียน</div>
              ) : (
                bookingsForDate.map((b) => (
                  <div key={b.id} style={styles.bookingRow}>
                    <div>
                      <strong>{b.user}</strong>
                      <div style={styles.rowSub}>
                        {b.time} · {b.className}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <section style={styles.adminBox}>
          {!adminMode ? (
            <>
              <div>
                <h2 style={styles.sectionTitle}>🔐 Admin Dashboard</h2>
                <p style={styles.sectionSub}>เปิดโหมดผู้ดูแลเพื่อ export CSV และดูสถิติ</p>
              </div>
              <div style={styles.adminLogin}>
                <input
                  style={styles.input}
                  placeholder="ใส่ Admin Key"
                  value={adminKeyInput}
                  onChange={(e) => setAdminKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loginAdmin()}
                />
                <button onClick={loginAdmin} style={styles.btnAccent}>
                  เข้า Admin
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <h2 style={styles.sectionTitle}>✅ Admin Enabled</h2>
                <p style={styles.sectionSub}>Export และดู Top usage</p>
              </div>
              <div style={styles.adminLogin}>
                <button onClick={exportCSV} style={styles.btnPrimarySmall}>
                  ⬇️ Export CSV
                </button>
                <button onClick={() => setAdminMode(false)} style={styles.btnGhost}>
                  ปิด Admin
                </button>
              </div>
            </>
          )}
        </section>

        {adminMode && (
          <section style={styles.adminGrid}>
            <div style={styles.card}>
              <h2 style={{ ...styles.sectionTitle, textAlign: 'left' }}>📊 Top Time Slots</h2>
              {topSlots.length === 0 ? (
                <div style={styles.empty}>ยังไม่มีข้อมูล</div>
              ) : (
                topSlots.map((s, idx) => (
                  <div key={s.slot} style={styles.rankRow}>
                    <span style={{ textAlign: 'left', flex: 1 }}>
                      {idx + 1}. {s.slot}
                    </span>
                    <strong>{s.count}</strong>
                  </div>
                ))
              )}
            </div>

            <div style={styles.card}>
              <h2 style={{ ...styles.sectionTitle, textAlign: 'left' }}>🏆 Top Users</h2>
              {topUsers.length === 0 ? (
                <div style={styles.empty}>ยังไม่มีข้อมูล</div>
              ) : (
                topUsers.map((u, idx) => (
                  <div key={u.name} style={styles.rankRow}>
                    <span style={{ textAlign: 'left', flex: 1 }}>
                      {idx + 1}. {u.name}
                    </span>
                    <strong>{u.count}</strong>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        <section style={styles.footerCard}>
          <div style={{ textAlign: 'center' }}>
            <strong>QR / Link สำหรับพนักงาน</strong>
            <div style={styles.urlText}>{REGISTER_URL}</div>
          </div>
        </section>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  green,
}: {
  label: string;
  value: string | number;
  green?: boolean;
}) {
  return (
    <div style={styles.miniStat}>
      <div style={styles.miniLabel}>{label}</div>
      <div style={{ ...styles.miniValue, color: green ? '#86efac' : 'white' }}>{value}</div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at top left, rgba(0,200,83,0.25), transparent 34%), linear-gradient(135deg, #07111f, #101827 55%, #211b2a)',
    color: 'white',
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: 12,
  },
  container: {
    maxWidth: 1080,
    margin: '0 auto',
  },
  loginWrap: {
    maxWidth: 460,
    margin: '0 auto',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    width: '100%',
    padding: 22,
    borderRadius: 30,
    background: 'rgba(255,255,255,0.09)',
    border: '1px solid rgba(255,255,255,0.15)',
    boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
    backdropFilter: 'blur(18px)',
  },
  loginHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 18,
    objectFit: 'contain',
    background: '#00C853',
    padding: 8,
    border: 'none',
    boxShadow: '0 14px 30px rgba(0,200,83,0.35)',
    flexShrink: 0,
  },
  logoSmall: {
    width: 58,
    height: 58,
    borderRadius: 16,
    objectFit: 'contain',
    background: '#00C853',
    padding: 7,
    boxShadow: '0 14px 30px rgba(0,200,83,0.28)',
    flexShrink: 0,
  },
  heroTitle: {
    fontSize: 24,
    margin: 0,
    fontWeight: 900,
    lineHeight: 1.15,
  },
  heroSub: {
    margin: '7px 0 0',
    color: '#a8b4c7',
    lineHeight: 1.45,
    fontSize: 14,
  },
  loginCard: {
    padding: 20,
    borderRadius: 24,
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.15)',
    textAlign: 'center',
  },
  loginTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 900,
  },
  loginDesc: {
    margin: '8px 0 16px',
    color: '#a8b4c7',
    fontSize: 14,
    lineHeight: 1.5,
  },
  inputCenter: {
    width: '100%',
    boxSizing: 'border-box',
    height: 54,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.1)',
    color: 'white',
    textAlign: 'center',
    fontSize: 15,
    outline: 'none',
    marginBottom: 12,
  },
  input: {
    height: 48,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.1)',
    color: 'white',
    padding: '0 14px',
    outline: 'none',
    minWidth: 180,
  },
  btnAccentFull: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    border: 'none',
    background: 'linear-gradient(90deg, #00C853, #22c55e)',
    color: '#07111f',
    fontWeight: 900,
    fontSize: 16,
    cursor: 'pointer',
    boxShadow: '0 16px 36px rgba(0,200,83,0.32)',
  },
  btnAccent: {
    height: 48,
    borderRadius: 14,
    border: 'none',
    padding: '0 18px',
    background: 'linear-gradient(90deg, #00C853, #22c55e)',
    color: '#07111f',
    fontWeight: 900,
    cursor: 'pointer',
  },
  btnPrimary: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    border: 'none',
    background: 'linear-gradient(90deg, #f97316, #ef4444)',
    color: 'white',
    fontWeight: 900,
    fontSize: 16,
    cursor: 'pointer',
    marginTop: 14,
    boxShadow: '0 16px 36px rgba(239,68,68,0.26)',
  },
  btnPrimarySmall: {
    height: 48,
    borderRadius: 14,
    border: 'none',
    padding: '0 18px',
    background: 'linear-gradient(90deg, #f97316, #ef4444)',
    color: 'white',
    fontWeight: 900,
    cursor: 'pointer',
  },
  btnGhost: {
    height: 42,
    borderRadius: 13,
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.08)',
    color: 'white',
    padding: '0 14px',
    cursor: 'pointer',
  },
  loginStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
    marginTop: 14,
  },
  miniStat: {
    padding: 10,
    borderRadius: 16,
    background: 'rgba(0,0,0,0.18)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  miniLabel: {
    fontSize: 11,
    color: '#a8b4c7',
    marginBottom: 5,
  },
  miniValue: {
    fontSize: 15,
    fontWeight: 900,
  },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '16px 0',
    flexWrap: 'wrap',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 950,
    lineHeight: 1.1,
  },
  sub: {
    color: '#a8b4c7',
    fontSize: 14,
    marginTop: 6,
  },
  topActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  online: {
    fontSize: 13,
    color: '#c7f9d4',
    padding: '8px 10px',
    borderRadius: 999,
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.25)',
  },
  noticeCard: {
    padding: 14,
    borderRadius: 18,
    background: 'rgba(0,200,83,0.1)',
    border: '1px solid rgba(0,200,83,0.2)',
    color: '#d9ffe3',
    marginBottom: 14,
    lineHeight: 1.5,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
    marginBottom: 14,
  },
  statCard: {
    padding: 16,
    borderRadius: 20,
    background: 'rgba(255,255,255,0.09)',
    border: '1px solid rgba(255,255,255,0.13)',
    boxShadow: '0 18px 48px rgba(0,0,0,0.18)',
  },
  statLabel: {
    color: '#a8b4c7',
    fontSize: 13,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 950,
  },
  flowGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 14,
  },
  card: {
    padding: 18,
    borderRadius: 24,
    background: 'rgba(255,255,255,0.09)',
    border: '1px solid rgba(255,255,255,0.13)',
    boxShadow: '0 18px 48px rgba(0,0,0,0.18)',
    backdropFilter: 'blur(14px)',
  },
  sectionTitle: {
    margin: 0,
    fontSize: 19,
    fontWeight: 950,
    textAlign: 'center',
  },
  sectionSub: {
    margin: '8px 0 14px',
    color: '#a8b4c7',
    fontSize: 14,
    lineHeight: 1.5,
    textAlign: 'center',
  },
  dateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))',
    gap: 10,
  },
  dateBtn: {
    border: '1px solid rgba(255,255,255,0.13)',
    borderRadius: 18,
    padding: 12,
    background: 'rgba(255,255,255,0.08)',
    color: 'white',
    cursor: 'pointer',
    textAlign: 'center',
    minHeight: 76,
  },
  dateBtnActive: {
    background: 'linear-gradient(135deg, #00C853, #22c55e)',
    color: '#07111f',
    boxShadow: '0 14px 34px rgba(0,200,83,0.26)',
    transform: 'translateY(-1px)',
  },
  classGuide: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  guideRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    background: 'rgba(0,0,0,0.16)',
    border: '1px solid rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  timeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 10,
  },
  timeBtn: {
    position: 'relative',
    border: '1px solid rgba(255,255,255,0.13)',
    borderRadius: 18,
    padding: 14,
    minHeight: 110,
    background: 'rgba(255,255,255,0.08)',
    color: 'white',
    cursor: 'pointer',
    textAlign: 'left',
    lineHeight: 1.5,
  },
  timeBtnActive: {
    background: 'linear-gradient(135deg, rgba(249,115,22,0.95), rgba(239,68,68,0.95))',
    borderColor: 'rgba(255,255,255,0.3)',
    boxShadow: '0 14px 34px rgba(239,68,68,0.25)',
  },
  timeBtnDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
    filter: 'grayscale(0.35)',
  },
  timeText: {
    fontWeight: 950,
    fontSize: 17,
    marginBottom: 5,
  },
  badge: {
    position: 'absolute',
    right: 10,
    top: 10,
    padding: '4px 8px',
    borderRadius: 999,
    background: 'rgba(239,68,68,0.25)',
    border: '1px solid rgba(239,68,68,0.35)',
    fontSize: 11,
  },
  message: {
    margin: '12px 0',
    padding: 12,
    borderRadius: 14,
    background: 'rgba(0,0,0,0.18)',
    border: '1px solid rgba(255,255,255,0.1)',
    textAlign: 'center',
    lineHeight: 1.5,
  },
  warnBox: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    background: 'rgba(239,68,68,0.14)',
    border: '1px solid rgba(239,68,68,0.26)',
    color: '#fecaca',
    textAlign: 'center',
    fontWeight: 800,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    maxHeight: 360,
    overflow: 'auto',
  },
  bookingRow: {
    padding: 12,
    borderRadius: 16,
    background: 'rgba(0,0,0,0.16)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  rowSub: {
    marginTop: 5,
    color: '#a8b4c7',
    fontSize: 13,
  },
  empty: {
    color: '#a8b4c7',
    padding: 14,
    borderRadius: 16,
    background: 'rgba(0,0,0,0.12)',
    border: '1px dashed rgba(255,255,255,0.15)',
    textAlign: 'center',
    width: '100%',
    boxSizing: 'border-box',
  },
  adminBox: {
    marginTop: 14,
    padding: 18,
    borderRadius: 24,
    background: 'rgba(255,255,255,0.09)',
    border: '1px solid rgba(255,255,255,0.13)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  adminLogin: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  adminGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 14,
    marginTop: 14,
  },
  rankRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    background: 'rgba(0,0,0,0.16)',
    border: '1px solid rgba(255,255,255,0.1)',
    marginTop: 10,
  },
  footerCard: {
    marginTop: 14,
    marginBottom: 20,
    padding: 18,
    borderRadius: 24,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  urlText: {
    marginTop: 8,
    color: '#a8b4c7',
    wordBreak: 'break-all',
    fontSize: 13,
  },
};
// update