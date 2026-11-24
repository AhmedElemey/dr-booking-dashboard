import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbar } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { map } from 'rxjs';

import { LanguageToggle } from '../../shared/language-toggle';
import { Role } from '../api/models';
import { AuthService } from '../auth/auth.service';
import { FeatureKey } from '../config/brand';
import { BrandService } from '../config/brand.service';
import { FeaturesService } from '../config/features.service';
import { ClinicTime } from '../time/clinic-time.service';

type NavGroup = 'today' | 'patients' | 'schedule' | 'money' | 'growth' | 'settings';

const GROUP_ORDER: NavGroup[] = ['today', 'patients', 'schedule', 'money', 'growth', 'settings'];

interface NavItem {
  group: NavGroup;
  labelKey: string;
  icon: string;
  link: string;
  roles: Role[];
  /** Hidden while this feature switch is off. */
  feature?: FeatureKey;
}

const STAFF_ROLES: Role[] = ['Doctor', 'ClinicStaff'];
const CLINIC_ROLES: Role[] = ['ClinicStaff'];
const ADMIN_ROLES: Role[] = ['ClinicStaff', 'PlatformAdmin'];

/** Application frame: side navigation, toolbar, account menu. Everything inside is signed in. */
@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbar,
    MatListModule,
    MatIcon,
    MatIconButton,
    MatButton,
    MatMenuModule,
    TranslatePipe,
    LanguageToggle,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly clinicTime = inject(ClinicTime);
  protected readonly brand = inject(BrandService);
  protected readonly features = inject(FeaturesService);

  protected readonly narrow = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 900px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly nav = computed<NavItem[]>(() => {
    const user = this.auth.user();
    if (!user) return [];
    const items: NavItem[] = [
      {
        labelKey: 'nav.agenda',
        icon: 'calendar_today',
        group: 'today',
        link: '/agenda',
        roles: STAFF_ROLES,
      },
      {
        labelKey: 'nav.newAppointment',
        icon: 'add_circle_outline',
        group: 'today',
        link: '/appointments/new',
        roles: STAFF_ROLES,
      },
      {
        labelKey: 'nav.slots',
        icon: 'event_available',
        group: 'schedule',
        link: '/slots',
        roles: STAFF_ROLES,
      },
      {
        labelKey: user.role === 'Doctor' ? 'nav.myProfile' : 'nav.doctors',
        icon: 'medical_services',
        group: 'schedule',
        link: user.role === 'Doctor' && user.doctorId ? `/doctors/${user.doctorId}` : '/doctors',
        roles: STAFF_ROLES,
      },
      {
        labelKey: 'nav.waitingList',
        icon: 'hourglass_top',
        group: 'today',
        link: '/waiting-list',
        roles: STAFF_ROLES,
        feature: 'waitingList',
      },
      {
        labelKey: 'nav.queue',
        icon: 'format_list_numbered',
        group: 'today',
        link: '/queue',
        roles: STAFF_ROLES,
        feature: 'liveQueue',
      },
      {
        labelKey: 'nav.patients',
        icon: 'folder_shared',
        group: 'patients',
        link: '/patients',
        roles: STAFF_ROLES,
        feature: 'patientRecords',
      },
      {
        labelKey: 'nav.payments',
        icon: 'payments',
        group: 'money',
        link: '/payments',
        roles: STAFF_ROLES,
        feature: 'onlinePayments',
      },
      {
        labelKey: 'nav.reviews',
        icon: 'star_rate',
        group: 'patients',
        link: '/reviews',
        roles: STAFF_ROLES,
        feature: 'reviews',
      },
      {
        labelKey: 'nav.reports',
        icon: 'insights',
        group: 'growth',
        link: '/reports',
        roles: STAFF_ROLES,
        feature: 'reports',
      },
      {
        labelKey: 'nav.holidays',
        icon: 'beach_access',
        group: 'schedule',
        link: '/holidays',
        roles: CLINIC_ROLES,
        feature: 'holidayCalendar',
      },
      {
        labelKey: 'nav.workingHours',
        icon: 'schedule',
        group: 'schedule',
        link: '/working-hours',
        roles: CLINIC_ROLES,
        feature: 'workingHoursTemplates',
      },
      {
        labelKey: 'nav.insurance',
        icon: 'health_and_safety',
        group: 'money',
        link: '/insurance',
        roles: ADMIN_ROLES,
        feature: 'insurance',
      },
      {
        labelKey: 'nav.coupons',
        icon: 'sell',
        group: 'money',
        link: '/coupons',
        roles: CLINIC_ROLES,
        feature: 'promotions',
      },
      {
        labelKey: 'nav.recall',
        icon: 'campaign',
        group: 'growth',
        link: '/recall',
        roles: CLINIC_ROLES,
        feature: 'recallCampaigns',
      },
      {
        labelKey: 'nav.messages',
        icon: 'forum',
        group: 'patients',
        link: '/messages',
        roles: ADMIN_ROLES,
        feature: 'whatsappReminders',
      },
      {
        labelKey: 'nav.clinic',
        icon: 'apartment',
        group: 'settings',
        link: '/clinic',
        roles: STAFF_ROLES,
      },
      {
        labelKey: 'nav.adminClinics',
        icon: 'domain',
        group: 'settings',
        link: '/admin/clinics',
        roles: ['PlatformAdmin'],
      },
    ];
    const flags = this.features.features();
    return items.filter(
      (item) => item.roles.includes(user.role) && (!item.feature || flags[item.feature]),
    );
  });

  /** The visible items under their group headers, in a fixed order; empty groups are dropped. */
  protected readonly navGroups = computed(() => {
    const items = this.nav();
    return GROUP_ORDER.map((group) => ({
      group,
      titleKey: `nav.groups.${group}`,
      items: items.filter((item) => item.group === group),
    })).filter((entry) => entry.items.length > 0);
  });

  ngOnInit(): void {
    if (this.auth.role() !== 'PlatformAdmin') {
      this.clinicTime.load().subscribe();
    }
  }

  protected logout(): void {
    this.auth.logout().subscribe();
  }
}
