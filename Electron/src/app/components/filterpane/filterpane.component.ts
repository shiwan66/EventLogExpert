import { Component, OnInit, OnDestroy } from '@angular/core';
import { EventLogService, FilterEventsAction, EventFilter } from '../../providers/eventlog.service';
import { takeUntil, distinctUntilKeyChanged, distinctUntilChanged } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { FormGroup, AbstractControl, FormControl } from '@angular/forms';

@Component({
  selector: 'app-filterpane',
  templateUrl: './filterpane.component.html',
  styleUrls: ['./filterpane.component.scss']
})
export class FilterPaneComponent implements OnInit, OnDestroy {

  ngUnsubscribe$ = new Subject<void>();
  allLevels = ['Information', 'Warning', 'Error'];
  form: FormGroup;
  ids: FormGroup;
  sources: FormGroup;
  tasks: FormGroup;
  levels: FormGroup;
  recentFilters: string[];

  constructor(private eventLogService: EventLogService) {
    const savedFiltersString = localStorage.getItem('savedFilters');
    if (savedFiltersString) {
      this.recentFilters = JSON.parse(savedFiltersString);
    } else {
      this.recentFilters = [];
    }
  }

  applyFilter(filter: EventFilter) {
    this.eventLogService.actions$.next(new FilterEventsAction(filter));
  }

  applyCurrentFilter() {
    const allIds = Object.getOwnPropertyNames(this.form.value.ids);
    const idsNotSelected = allIds.filter(i => this.form.value.ids[i] === false);
    const idFilter = idsNotSelected.length === 0 ? null :
      new Set<number>(allIds.filter(i => this.form.value.ids[i] === true).map(i => parseInt(i, 10)));

    const allProviders = Object.getOwnPropertyNames(this.form.value.sources);
    const providersNotSelected = allProviders.filter(i => this.form.value.sources[i] === false);
    const providerFilter = providersNotSelected.length === 0 ? null :
      new Set<string>(allProviders.filter(i => this.form.value.sources[i] === true));

    const allTasks = Object.getOwnPropertyNames(this.form.value.tasks);
    const tasksNotSelected = allTasks.filter(i => this.form.value.tasks[i] === false);
    const taskFilter = tasksNotSelected.length === 0 ? null :
      new Set<string>(allTasks.filter(i => this.form.value.tasks[i] === true));

    const levelsNotSelected = this.allLevels.filter(i => this.form.value.levels[i] === false);
    const levelFilter = levelsNotSelected.length === 0 ? null :
      new Set<string>(this.allLevels.filter(i => this.form.value.levels[i] === true));

    const filter: EventFilter = {
      ids: idFilter,
      sources: providerFilter,
      tasks: taskFilter,
      levels: levelFilter,
      description: null
    };

    const filterString = this.stringifyFilter(filter);
    if (this.recentFilters.indexOf(filterString) < 0) {
      this.recentFilters.unshift(filterString);
      localStorage.setItem('savedFilters', JSON.stringify(this.recentFilters));
    }

    this.applyFilter(filter);
  }

  applySavedFilter(filterString: string) {
    const filter = this.unstringifyFilter(filterString);
    this.applyFilter(filter);
  }

  ngOnDestroy() {
    this.ngUnsubscribe$.next();
  }

  ngOnInit() {
    this.eventLogService.state$.pipe(takeUntil(this.ngUnsubscribe$), distinctUntilChanged()).subscribe(s => {
      const ids: { [key: string]: AbstractControl } = {};
      s.uniqueRecordValues.id.forEach(i => {
        const isIncludedInFilter = !s.filter || !s.filter.ids || s.filter.ids.has(i);
        ids[`${i}`] = new FormControl(isIncludedInFilter);
      });
      this.ids = new FormGroup(ids);

      const sources: { [key: string]: AbstractControl } = {};
      s.uniqueRecordValues.providerName.forEach(i => {
        const isIncludedInFilter = !s.filter || !s.filter.sources || s.filter.sources.has(i);
        sources[`${i}`] = new FormControl(isIncludedInFilter);
      });
      this.sources = new FormGroup(sources);

      const tasks: { [key: string]: AbstractControl } = {};
      s.uniqueRecordValues.taskName.forEach(i => {
        const isIncludedInFilter = !s.filter || !s.filter.tasks || s.filter.tasks.has(i);
        tasks[`${i}`] = new FormControl(isIncludedInFilter);
      });
      this.tasks = new FormGroup(tasks);

      const levels: { [key: string]: AbstractControl } = {};
      levels['Information'] = new FormControl(!s.filter || !s.filter.levels || s.filter.levels.has('Information'));
      levels['Warning'] = new FormControl(!s.filter || !s.filter.levels || s.filter.levels.has('Warning'));
      levels['Error'] = new FormControl(!s.filter || !s.filter.levels || s.filter.levels.has('Error'));
      this.levels = new FormGroup(levels);

      this.form = new FormGroup({
        ids: this.ids,
        sources: this.sources,
        tasks: this.tasks,
        levels: this.levels
      });
    });
  }

  resetFilter() {
    this.applyFilter({ description: null, ids: null, levels: null, sources: null, tasks: null});
  }

  stringifyFilter(filter: EventFilter): string {
    const slimFilter = {};
    if (filter.description) {
      slimFilter['description'] = filter.description;
    }
    if (filter.ids && filter.ids.size > 0) {
      slimFilter['ids'] = Array.from(filter.ids);
    }
    if (filter.levels && filter.levels.size > 0) {
      slimFilter['levels'] = Array.from(filter.levels);
    }
    if (filter.sources) {
      slimFilter['sources'] = Array.from(filter.sources);
    }
    if (filter.tasks) {
      slimFilter['tasks'] = Array.from(filter.tasks);
    }

    return JSON.stringify(slimFilter);
  }

  unstringifyFilter(s: string): EventFilter {
    const strObj = JSON.parse(s);
    return {
      description: strObj['description'] ? strObj['description'] : null,
      ids: strObj['ids'] ? new Set(strObj['ids']) : null,
      levels: strObj['levels'] ? new Set(strObj['levels']) : null,
      sources: strObj['sources'] ? new Set(strObj['sources']) : null,
      tasks: strObj['tasks'] ? new Set(strObj['tasks']) : null
    };
  }
}
