import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconButton } from '@angular/material/button';
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
import { ClinicTime } from '../time/clinic-time.service';

interface NavItem {
  labelKey: string;
  icon: string;
  link: string;
  roles: Role[];
}

const STAFF_ROLES: Role[] = ['Doctor', 'ClinicStaff'];

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
      { labelKey: 'nav.agenda', icon: 'calendar_today', link: '/agenda', roles: STAFF_ROLES },
      {
        labelKey: 'nav.newAppointment',
        icon: 'add_circle_outline',
        link: '/appointments/new',
        roles: STAFF_ROLES,
      },
      { labelKey: 'nav.slots', icon: 'event_available', link: '/slots', roles: STAFF_ROLES },
      {
        labelKey: user.role === 'Doctor' ? 'nav.myProfile' : 'nav.doctors',
        icon: 'medical_services',
        link: user.role === 'Doctor' && user.doctorId ? `/doctors/${user.doctorId}` : '/doctors',
        roles: STAFF_ROLES,
      },
      { labelKey: 'nav.clinic', icon: 'apartment', link: '/clinic', roles: STAFF_ROLES },
      {
        labelKey: 'nav.adminClinics',
        icon: 'domain',
        link: '/admin/clinics',
        roles: ['PlatformAdmin'],
      },
    ];
    return items.filter((item) => item.roles.includes(user.role));
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
