<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import {
  Plus,
  Refresh,
  OfficeBuilding,
  Connection,
  CircleCheck,
  Money,
  Edit,
  Delete,
  FolderAdd,
  Lock,
  Unlock
} from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { useTenantStore } from '@/stores/tenant';
import type { Department } from '@/types/tenant';
import PermissionGate from '@/components/PermissionGate.vue';
import { t } from '@/i18n';

const authStore = useAuthStore();
const tenantStore = useTenantStore();

const loading = ref(false);
const canManage = computed(() => authStore.hasRole(['owner', 'admin']));

async function refreshDepartments() {
  loading.value = true;
  try {
    await tenantStore.loadDepartments();
  } catch (err: unknown) {
    const msg = err instanceof Error ? t(err.message) : t('加载部门列表失败');
    ElMessage.error(msg);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  refreshDepartments();
});

// Map of departments for quick lookup of parent names
const departmentMap = computed(() => {
  const map: Record<string, Department> = {};
  tenantStore.availableDepartments.forEach((d) => {
    map[d.department_id] = d;
  });
  return map;
});

// Tree node definition for el-table hierarchical display
interface DepartmentNode extends Department {
  children?: DepartmentNode[];
}

// Convert flat department list to tree structure for collapsible el-table
const departmentTree = computed<DepartmentNode[]>(() => {
  const list = tenantStore.availableDepartments;
  const map: Record<string, DepartmentNode> = {};
  const roots: DepartmentNode[] = [];

  list.forEach((d) => {
    map[d.department_id] = { ...d, children: [] };
  });

  list.forEach((d) => {
    if (d.parent_id && map[d.parent_id]) {
      map[d.parent_id].children?.push(map[d.department_id]);
    } else {
      roots.push(map[d.department_id]);
    }
  });

  return roots;
});

// Metrics
const activeDepartmentsCount = computed(() => {
  return tenantStore.availableDepartments.filter((d) => d.status === 'active').length;
});

const totalMonthlyBudgetCny = computed(() => {
  const total = tenantStore.availableDepartments.reduce(
    (acc, d) => acc + (d.budget_cap_monthly_base_units || 0),
    0
  );
  return (total / 1000000).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
});

// ----------------------------------------------------------------------------
// Create Department Dialog
// ----------------------------------------------------------------------------
const createDialogVisible = ref(false);
const createLoading = ref(false);
const createFormRef = ref<FormInstance>();
const createForm = reactive({
  name: '',
  parent_id: '' as string | null,
  budget_cap_monthly_cny: 10000
});

const departmentRules: FormRules = {
  name: [
    { required: true, message: t('请输入部门名称'), trigger: 'blur' },
    { min: 2, max: 64, message: t('长度在 2 到 64 个字符'), trigger: 'blur' }
  ],
  budget_cap_monthly_cny: [
    { required: true, message: t('请输入月度预算上限'), trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value < 0) {
          callback(new Error(t('预算上限不能小于 0')));
        } else {
          callback();
        }
      },
      trigger: 'blur'
    }
  ]
};

function openCreateDialog(parentId: string | null = null) {
  createForm.name = '';
  createForm.parent_id = parentId;
  createForm.budget_cap_monthly_cny = 10000;
  createDialogVisible.value = true;
}

async function handleCreateDepartment() {
  if (!createFormRef.value) return;
  await createFormRef.value.validate(async (valid) => {
    if (!valid) return;
    createLoading.value = true;
    try {
      const budgetBaseUnits = Math.round(createForm.budget_cap_monthly_cny * 1000000);
      await tenantStore.createDepartment({
        name: createForm.name.trim(),
        parent_id: createForm.parent_id ? createForm.parent_id : null,
        budget_cap_monthly_base_units: budgetBaseUnits
      });
      ElMessage.success(t('部门创建成功'));
      createDialogVisible.value = false;
      await refreshDepartments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? t(err.message) : t('创建部门失败');
      ElMessage.error(msg);
    } finally {
      createLoading.value = false;
    }
  });
}

// ----------------------------------------------------------------------------
// Edit Department Dialog
// ----------------------------------------------------------------------------
const editDialogVisible = ref(false);
const editLoading = ref(false);
const editFormRef = ref<FormInstance>();
const editingDepartmentId = ref('');
const editForm = reactive({
  name: '',
  parent_id: '' as string | null,
  budget_cap_monthly_cny: 10000,
  status: 'active' as 'active' | 'archived'
});

function openEditDialog(dept: Department) {
  editingDepartmentId.value = dept.department_id;
  editForm.name = dept.name;
  editForm.parent_id = dept.parent_id || null;
  editForm.budget_cap_monthly_cny = (dept.budget_cap_monthly_base_units || 0) / 1000000;
  editForm.status = dept.status || 'active';
  editDialogVisible.value = true;
}

// Eligible parents for edit (exclude self)
const eligibleParentsForEdit = computed(() => {
  return tenantStore.availableDepartments.filter((d) => d.department_id !== editingDepartmentId.value);
});

async function handleUpdateDepartment() {
  if (!editFormRef.value || !editingDepartmentId.value) return;
  await editFormRef.value.validate(async (valid) => {
    if (!valid) return;
    editLoading.value = true;
    try {
      const budgetBaseUnits = Math.round(editForm.budget_cap_monthly_cny * 1000000);
      await tenantStore.updateDepartment(editingDepartmentId.value, {
        name: editForm.name.trim(),
        parent_id: editForm.parent_id ? editForm.parent_id : null,
        budget_cap_monthly_base_units: budgetBaseUnits,
        status: editForm.status
      });
      ElMessage.success(t('部门信息更新成功'));
      editDialogVisible.value = false;
      await refreshDepartments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? t(err.message) : t('更新部门失败');
      ElMessage.error(msg);
    } finally {
      editLoading.value = false;
    }
  });
}

// ----------------------------------------------------------------------------
// Toggle Archive / Delete
// ----------------------------------------------------------------------------
async function toggleArchive(dept: Department) {
  const targetStatus = dept.status === 'active' ? 'archived' : 'active';
  const actionText = targetStatus === 'active' ? t('激活') : t('归档');

  try {
    await ElMessageBox.confirm(
      `${t('确定要')}${actionText}${t('部门')} "${dept.name}" ${t('吗？归档后该部门下的项目与 Agent 将无法继续发起消费。')}`,
      t('部门状态确认'),
      {
        type: 'warning',
        confirmButtonText: t('确定'),
        cancelButtonText: t('取消')
      }
    );

    await tenantStore.updateDepartment(dept.department_id, {
      status: targetStatus
    });
    ElMessage.success(`${t('部门已')}${actionText}`);
    await refreshDepartments();
  } catch (err: unknown) {
    if (err !== 'cancel') {
      const msg = err instanceof Error ? t(err.message) : t('操作失败');
      ElMessage.error(msg);
    }
  }
}

async function handleDeleteDepartment(dept: Department) {
  try {
    await ElMessageBox.confirm(
      `${t('确定要删除部门')} "${dept.name}" ${t('吗？删除后关联子部门将自动断开，该操作不可逆！')}`,
      t('删除部门确认'),
      {
        type: 'error',
        confirmButtonText: t('确认删除'),
        cancelButtonText: t('取消')
      }
    );

    await tenantStore.deleteDepartment(dept.department_id);
    ElMessage.success(t('部门已成功删除'));
    await refreshDepartments();
  } catch (err: unknown) {
    if (err !== 'cancel') {
      const msg = err instanceof Error ? t(err.message) : t('删除失败');
      ElMessage.error(msg);
    }
  }
}
</script>

<template>
  <div class="departments-page" v-loading="loading">
    <!-- 1. Header Banner Card -->
    <el-card shadow="never" class="header-card">
      <div class="header-layout">
        <div class="header-left">
          <div class="header-icon-box">
            <el-icon><OfficeBuilding /></el-icon>
          </div>
          <div class="header-titles">
            <div class="title-line">
              <h1 class="main-title">{{ t('部门与成本中心') }}</h1>
              <el-tag size="small" type="primary" effect="plain" class="scope-tag">
                {{ t('当前组织') }}: {{ tenantStore.currentTenant?.name || 'AgentPay Default' }}
              </el-tag>
            </div>
            <p class="sub-description">
              {{ t('建立组织树状多层成本中心与配额硬顶，实现「企业 → 部门 → 项目 → Agent」级联预算管控与穿透审计') }}
            </p>
          </div>
        </div>

        <div class="header-actions">
          <el-button :icon="Refresh" :loading="loading" @click="refreshDepartments">
            {{ t('刷新') }}
          </el-button>
          <PermissionGate :roles="['owner', 'admin']">
            <el-button type="primary" :icon="Plus" @click="openCreateDialog(null)">
              {{ t('新建根部门') }}
            </el-button>
          </PermissionGate>
        </div>
      </div>
    </el-card>

    <!-- 2. Metrics Statistics Grid -->
    <el-row :gutter="16" class="metrics-row">
      <!-- Metric 1: Total Departments -->
      <el-col :xs="24" :sm="8">
        <el-card shadow="hover" class="metric-card">
          <div class="metric-inner">
            <div class="metric-text-group">
              <span class="metric-label">{{ t('部门节点总数') }}</span>
              <div class="metric-val text-blue">
                {{ tenantStore.availableDepartments.length }}
                <span class="metric-unit">个部门</span>
              </div>
              <div class="metric-hint">覆盖各业务事业群与研发组拓扑</div>
            </div>
            <div class="metric-icon-wrap color-blue">
              <el-icon><OfficeBuilding /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- Metric 2: Active Departments -->
      <el-col :xs="24" :sm="8">
        <el-card shadow="hover" class="metric-card">
          <div class="metric-inner">
            <div class="metric-text-group">
              <span class="metric-label">{{ t('活跃成本中心') }}</span>
              <div class="metric-val text-green">
                {{ activeDepartmentsCount }}
                <span class="metric-unit">/ {{ tenantStore.availableDepartments.length }}</span>
              </div>
              <div class="metric-hint">
                <span class="status-dot online"></span>
                {{ t('配额实时熔断防护中') }}
              </div>
            </div>
            <div class="metric-icon-wrap color-green">
              <el-icon><CircleCheck /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- Metric 3: Total Budget Allocated -->
      <el-col :xs="24" :sm="8">
        <el-card shadow="hover" class="metric-card">
          <div class="metric-inner">
            <div class="metric-text-group">
              <span class="metric-label">{{ t('月度预算配置总和') }}</span>
              <div class="metric-val text-orange">
                ¥{{ totalMonthlyBudgetCny }}
                <span class="metric-unit">CNY</span>
              </div>
              <div class="metric-hint">{{ t('企业各部门月度预算硬顶汇总') }}</div>
            </div>
            <div class="metric-icon-wrap color-orange">
              <el-icon><Money /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 3. Departments Tree Table Card -->
    <el-card shadow="never" class="table-card">
      <template #header>
        <div class="table-card-header">
          <div class="table-header-title">
            <el-icon class="mr-1 text-primary"><Connection /></el-icon>
            <span>{{ t('组织层级树状架构与月度预算清单') }}</span>
          </div>
          <div class="table-header-meta">
            <el-tag size="small" type="info" effect="plain">
              {{ t('支持无限级树形折叠') }}
            </el-tag>
          </div>
        </div>
      </template>

      <el-table
        v-loading="loading"
        :data="departmentTree"
        row-key="department_id"
        default-expand-all
        stripe
        style="width: 100%"
      >
        <!-- Department Name & Tree Node -->
        <el-table-column prop="name" :label="t('部门名称')" min-width="240">
          <template #default="{ row }">
            <div class="dept-name-cell">
              <el-icon class="dept-icon"><OfficeBuilding /></el-icon>
              <span class="dept-name-text">{{ row.name }}</span>
              <el-tag
                v-if="!row.parent_id"
                size="small"
                type="primary"
                effect="light"
                class="node-tag"
              >
                {{ t('根部门') }}
              </el-tag>
              <el-tag
                v-if="row.children && row.children.length > 0"
                size="small"
                type="info"
                effect="plain"
                class="node-tag"
              >
                {{ row.children.length }} {{ t('个子部门') }}
              </el-tag>
            </div>
          </template>
        </el-table-column>

        <!-- Department ID -->
        <el-table-column prop="department_id" :label="t('部门 ID')" min-width="160">
          <template #default="{ row }">
            <code class="code-id">{{ row.department_id }}</code>
          </template>
        </el-table-column>

        <!-- Parent Department -->
        <el-table-column :label="t('所属上级')" min-width="160">
          <template #default="{ row }">
            <div v-if="row.parent_id && departmentMap[row.parent_id]" class="parent-cell">
              <el-icon class="mr-1"><Connection /></el-icon>
              <span>{{ departmentMap[row.parent_id].name }}</span>
            </div>
            <span v-else class="text-muted-dash">- 顶级 -</span>
          </template>
        </el-table-column>

        <!-- Monthly Budget Cap -->
        <el-table-column :label="t('月度预算上限 (CNY)')" min-width="180">
          <template #default="{ row }">
            <div class="budget-cell">
              <span class="budget-amount">
                {{ tenantStore.formatCurrency(row.budget_cap_monthly_base_units, true) }}
              </span>
              <span class="budget-sub">
                {{ (row.budget_cap_monthly_base_units || 0).toLocaleString() }} base units
              </span>
            </div>
          </template>
        </el-table-column>

        <!-- Status -->
        <el-table-column prop="status" :label="t('状态')" width="110" align="center">
          <template #default="{ row }">
            <el-tag
              :type="row.status === 'active' ? 'success' : 'info'"
              size="small"
              class="status-tag"
            >
              <span
                :class="row.status === 'active' ? 'status-dot online' : 'status-dot offline'"
                style="margin-right: 4px;"
              ></span>
              {{ row.status === 'active' ? t('正常') : t('已归档') }}
            </el-tag>
          </template>
        </el-table-column>

        <!-- Actions -->
        <el-table-column :label="t('操作')" width="230" fixed="right">
          <template #default="{ row }">
            <div class="actions-group">
              <PermissionGate :roles="['owner', 'admin']">
                <el-button
                  link
                  type="primary"
                  size="small"
                  :icon="FolderAdd"
                  @click="openCreateDialog(row.department_id)"
                  :title="t('在该部门下建立子部门')"
                >
                  {{ t('+ 子部门') }}
                </el-button>
                <el-button
                  link
                  type="primary"
                  size="small"
                  :icon="Edit"
                  @click="openEditDialog(row)"
                >
                  {{ t('编辑') }}
                </el-button>
                <el-button
                  link
                  :type="row.status === 'active' ? 'warning' : 'success'"
                  size="small"
                  :icon="row.status === 'active' ? Lock : Unlock"
                  @click="toggleArchive(row)"
                >
                  {{ row.status === 'active' ? t('归档') : t('激活') }}
                </el-button>
                <el-button
                  link
                  type="danger"
                  size="small"
                  :icon="Delete"
                  @click="handleDeleteDepartment(row)"
                >
                  {{ t('删除') }}
                </el-button>
              </PermissionGate>
              <span v-if="!canManage" class="readonly-text">{{ t('只读权限') }}</span>
            </div>
          </template>
        </el-table-column>

        <template #empty>
          <div class="empty-box">
            <el-empty :description="t('暂无部门数据，点击上方按钮新建根部门')">
              <PermissionGate :roles="['owner', 'admin']">
                <el-button type="primary" :icon="Plus" @click="openCreateDialog(null)">
                  {{ t('新建首个根部门') }}
                </el-button>
              </PermissionGate>
            </el-empty>
          </div>
        </template>
      </el-table>
    </el-card>

    <!-- Create Department Dialog -->
    <el-dialog
      v-model="createDialogVisible"
      :title="t(createForm.parent_id ? '新建子部门' : '新建根部门')"
      width="540px"
      destroy-on-close
    >
      <el-form
        ref="createFormRef"
        :model="createForm"
        :rules="departmentRules"
        label-position="top"
      >
        <el-form-item :label="t('上级部门归属')" prop="parent_id">
          <el-select
            v-model="createForm.parent_id"
            placeholder="无上级（创建为顶级根部门）"
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="dept in tenantStore.availableDepartments"
              :key="dept.department_id"
              :label="dept.name"
              :value="dept.department_id"
            />
          </el-select>
        </el-form-item>

        <el-form-item :label="t('部门名称')" prop="name">
          <el-input
            v-model="createForm.name"
            placeholder="例如：产研中心、风控与合规部、海外运营组"
            maxlength="64"
            show-word-limit
          />
        </el-form-item>

        <el-form-item :label="t('月度预算上限 (CNY ¥)')" prop="budget_cap_monthly_cny">
          <el-input-number
            v-model="createForm.budget_cap_monthly_cny"
            :min="0"
            :step="1000"
            style="width: 100%"
          />
          <div class="form-tip">
            {{ t('转换为微单位') }}:
            <strong>{{ (createForm.budget_cap_monthly_cny * 1000000).toLocaleString() }}</strong>
            base units (1 元 = 1,000,000 微单位，精确防浮点溢出)
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="createDialogVisible = false">{{ t('取消') }}</el-button>
          <el-button type="primary" :loading="createLoading" @click="handleCreateDepartment">
            {{ t('确定创建') }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Edit Department Dialog -->
    <el-dialog
      v-model="editDialogVisible"
      :title="t('编辑部门信息')"
      width="540px"
      destroy-on-close
    >
      <el-form
        ref="editFormRef"
        :model="editForm"
        :rules="departmentRules"
        label-position="top"
      >
        <el-form-item :label="t('上级部门归属')" prop="parent_id">
          <el-select
            v-model="editForm.parent_id"
            placeholder="无上级（顶级根部门）"
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="dept in eligibleParentsForEdit"
              :key="dept.department_id"
              :label="dept.name"
              :value="dept.department_id"
            />
          </el-select>
        </el-form-item>

        <el-form-item :label="t('部门名称')" prop="name">
          <el-input
            v-model="editForm.name"
            placeholder="输入部门名称"
            maxlength="64"
            show-word-limit
          />
        </el-form-item>

        <el-form-item :label="t('月度预算上限 (CNY ¥)')" prop="budget_cap_monthly_cny">
          <el-input-number
            v-model="editForm.budget_cap_monthly_cny"
            :min="0"
            :step="1000"
            style="width: 100%"
          />
          <div class="form-tip">
            {{ t('转换为微单位') }}:
            <strong>{{ (editForm.budget_cap_monthly_cny * 1000000).toLocaleString() }}</strong>
            base units
          </div>
        </el-form-item>

        <el-form-item :label="t('状态')" prop="status">
          <el-radio-group v-model="editForm.status">
            <el-radio label="active">{{ t('正常生效 (Active)') }}</el-radio>
            <el-radio label="archived">{{ t('归档冻结 (Archived)') }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="editDialogVisible = false">{{ t('取消') }}</el-button>
          <el-button type="primary" :loading="editLoading" @click="handleUpdateDepartment">
            {{ t('保存变更') }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.departments-page {
  padding: 20px;
}

/* Header Card */
.header-card {
  border-radius: 10px;
  border: 1px solid #e4e7ed;
  background: #ffffff;
  margin-bottom: 16px;
}

.header-layout {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon-box {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: #ecf5ff;
  color: #409eff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}

.header-titles {
  display: flex;
  flex-direction: column;
}

.title-line {
  display: flex;
  align-items: center;
  gap: 12px;
}

.main-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #303133;
}

.scope-tag {
  font-weight: 500;
}

.sub-description {
  margin: 6px 0 0 0;
  font-size: 13px;
  color: #909399;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Metrics Row */
.metrics-row {
  margin-bottom: 16px;
}

.metric-card {
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  background: #ffffff;
  transition: all 0.2s ease-in-out;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.metric-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metric-text-group {
  display: flex;
  flex-direction: column;
}

.metric-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 6px;
}

.metric-val {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.2;
}

.text-blue {
  color: #409eff;
}

.text-green {
  color: #67c23a;
}

.text-orange {
  color: #e6a23c;
}

.metric-unit {
  font-size: 13px;
  font-weight: 400;
  color: #909399;
  margin-left: 6px;
}

.metric-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.metric-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}

.color-blue {
  background: #ecf5ff;
  color: #409eff;
}

.color-green {
  background: #f0f9eb;
  color: #67c23a;
}

.color-orange {
  background: #fdf6ec;
  color: #e6a23c;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
}

.status-dot.online {
  background-color: #67c23a;
}

.status-dot.offline {
  background-color: #909399;
}

/* Table Card */
.table-card {
  border-radius: 10px;
  border: 1px solid #e4e7ed;
  background: #ffffff;
}

.table-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.table-header-title {
  display: flex;
  align-items: center;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.dept-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dept-icon {
  font-size: 16px;
  color: #409eff;
}

.dept-name-text {
  font-weight: 600;
  color: #303133;
}

.node-tag {
  font-size: 11px;
}

.code-id {
  font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
  font-size: 12px;
  background: #f4f4f5;
  color: #606266;
  padding: 2px 6px;
  border-radius: 4px;
}

.parent-cell {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #606266;
}

.text-muted-dash {
  color: #c0c4cc;
  font-size: 12px;
}

.budget-cell {
  display: flex;
  flex-direction: column;
}

.budget-amount {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.budget-sub {
  font-size: 11px;
  color: #909399;
}

.status-tag {
  display: inline-flex;
  align-items: center;
}

.actions-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.readonly-text {
  font-size: 12px;
  color: #909399;
}

.empty-box {
  padding: 40px 0;
}

/* Form Tips & Dialog */
.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
  line-height: 1.4;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
