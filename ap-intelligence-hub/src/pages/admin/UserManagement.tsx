import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLE_CONFIG } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/formatters';
import { TableSkeleton } from '@/components/shared/PageSkeleton';
import type { User, UserRole } from '@/types/user';

interface UserFormData {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  department: string;
  approvalLimit: number | undefined;
}

const emptyFormData: UserFormData = {
  firstName: '',
  lastName: '',
  email: '',
  role: 'AP_AGENT',
  department: '',
  approvalLimit: undefined,
};

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Add User dialog state
  const [showFilters, setShowFilters] = useState(false);

  // Add User dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState<UserFormData>(emptyFormData);
  const [addLoading, setAddLoading] = useState(false);

  // Edit User dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<UserFormData>(emptyFormData);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    import('@/lib/handlers').then(({ fetchUsers }) => {
      fetchUsers().then((data) => {
        setUsers(data);
        setIsLoading(false);
      }).catch(() => setIsLoading(false));
    });
  }, []);

  const filteredUsers = users.filter(u => {
    const matchesSearch = !searchQuery ||
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const toggleActive = (userId: string) => {
    setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, isActive: !u.isActive } : u
    ));
  };

  // --- Add User ---
  const handleOpenAddDialog = () => {
    setAddForm(emptyFormData);
    setAddDialogOpen(true);
  };

  const handleAddUser = async () => {
    if (!addForm.firstName || !addForm.lastName || !addForm.email || !addForm.department) return;
    setAddLoading(true);
    try {
      const { addUser, fetchUsers } = await import('@/lib/handlers');
      await addUser({
        firstName: addForm.firstName,
        lastName: addForm.lastName,
        email: addForm.email,
        role: addForm.role,
        department: addForm.department,
        approvalLimit: addForm.role === 'AP_REVIEWER' ? addForm.approvalLimit : undefined,
      });
      const updatedUsers = await fetchUsers();
      setUsers(updatedUsers);
      setAddDialogOpen(false);
      setAddForm(emptyFormData);
    } catch {
      // handle error
    } finally {
      setAddLoading(false);
    }
  };

  // --- Edit User ---
  const handleOpenEditDialog = (user: User) => {
    setEditUserId(user.id);
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      department: user.department,
      approvalLimit: user.approvalLimit,
    });
    setEditDialogOpen(true);
  };

  const handleEditUser = async () => {
    if (!editUserId || !editForm.firstName || !editForm.lastName || !editForm.email || !editForm.department) return;
    setEditLoading(true);
    try {
      const { updateUser } = await import('@/lib/handlers');
      await updateUser(editUserId, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        fullName: `${editForm.firstName} ${editForm.lastName}`,
        email: editForm.email,
        role: editForm.role,
        department: editForm.department,
        approvalLimit: editForm.role === 'AP_REVIEWER' ? editForm.approvalLimit : undefined,
      });
      setUsers(prev => prev.map(u =>
        u.id === editUserId
          ? {
              ...u,
              firstName: editForm.firstName,
              lastName: editForm.lastName,
              fullName: `${editForm.firstName} ${editForm.lastName}`,
              email: editForm.email,
              role: editForm.role,
              department: editForm.department,
              approvalLimit: editForm.role === 'AP_REVIEWER' ? editForm.approvalLimit : undefined,
            }
          : u
      ));
      setEditDialogOpen(false);
      setEditUserId(null);
    } catch {
      // handle error
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="User Management" count={users.length}>
        <Button className="gap-2" onClick={handleOpenAddDialog}>
          <Plus className="h-4 w-4" />
          Add User
        </Button>
      </PageHeader>
      <p className="text-sm text-muted-foreground -mt-4 mb-4">Manage user accounts, roles, and access permissions.</p>

      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            className="gap-2 shrink-0"
            onClick={() => setShowFilters(v => !v)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {roleFilter !== 'all' && (
              <Badge variant={showFilters ? 'secondary' : 'default'} className="h-5 min-w-5 px-1.5 text-[11px] rounded-full">
                1
              </Badge>
            )}
          </Button>
          {(roleFilter !== 'all' || searchQuery) && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground shrink-0"
              onClick={() => { setSearchQuery(''); setRoleFilter('all'); }}
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
        <div className={cn(
          'overflow-hidden transition-all duration-300 ease-in-out',
          showFilters ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
        )}>
          <div className="flex items-center gap-2 flex-wrap p-3 bg-muted/40 rounded-lg border">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="AP_AGENT">AP Agent</SelectItem>
                <SelectItem value="AP_REVIEWER">AP Reviewer</SelectItem>
                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : null}
      <Card className={isLoading ? 'hidden' : ''}>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => {
                const roleConfig = ROLE_CONFIG[u.role];
                const initials = `${u.firstName[0]}${u.lastName[0]}`;
                return (
                  <TableRow
                    key={u.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => handleOpenEditDialog(u)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{u.fullName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${roleConfig.bgColor} ${roleConfig.color} border-transparent`}>
                        {roleConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{u.department}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.lastLoginAt ? formatRelativeTime(u.lastLoginAt) : 'Never'}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={u.isActive}
                        onCheckedChange={() => toggleActive(u.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg">Add New User</DialogTitle>
            <DialogDescription>Create a new user account for InvoiceIQ.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="add-firstName" className="text-sm font-medium">First Name</Label>
                <Input
                  id="add-firstName"
                  value={addForm.firstName}
                  onChange={(e) => setAddForm(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="John"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-lastName" className="text-sm font-medium">Last Name</Label>
                <Input
                  id="add-lastName"
                  value={addForm.lastName}
                  onChange={(e) => setAddForm(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Smith"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-email" className="text-sm font-medium">Email</Label>
              <Input
                id="add-email"
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="john.smith@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-role" className="text-sm font-medium">Role</Label>
              <Select
                value={addForm.role}
                onValueChange={(value: string) => setAddForm(prev => ({ ...prev, role: value as UserRole }))}
              >
                <SelectTrigger id="add-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AP_AGENT">AP Agent</SelectItem>
                  <SelectItem value="AP_REVIEWER">AP Reviewer</SelectItem>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-department" className="text-sm font-medium">Department</Label>
              <Input
                id="add-department"
                value={addForm.department}
                onChange={(e) => setAddForm(prev => ({ ...prev, department: e.target.value }))}
                placeholder="Accounts Payable"
              />
            </div>
            {addForm.role === 'AP_REVIEWER' && (
              <div className="space-y-1.5">
                <Label htmlFor="add-approvalLimit" className="text-sm font-medium">Approval Limit (AUD)</Label>
                <Input
                  id="add-approvalLimit"
                  type="number"
                  value={addForm.approvalLimit ?? ''}
                  onChange={(e) => setAddForm(prev => ({ ...prev, approvalLimit: e.target.value ? Number(e.target.value) : undefined }))}
                  placeholder="500000"
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddUser}
              disabled={addLoading || !addForm.firstName || !addForm.lastName || !addForm.email || !addForm.department}
            >
              {addLoading ? 'Adding...' : 'Add User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg">Edit User</DialogTitle>
            <DialogDescription>Update user account details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-firstName" className="text-sm font-medium">First Name</Label>
                <Input
                  id="edit-firstName"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-lastName" className="text-sm font-medium">Last Name</Label>
                <Input
                  id="edit-lastName"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email" className="text-sm font-medium">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-role" className="text-sm font-medium">Role</Label>
              <Select
                value={editForm.role}
                onValueChange={(value: string) => setEditForm(prev => ({ ...prev, role: value as UserRole }))}
              >
                <SelectTrigger id="edit-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AP_AGENT">AP Agent</SelectItem>
                  <SelectItem value="AP_REVIEWER">AP Reviewer</SelectItem>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-department" className="text-sm font-medium">Department</Label>
              <Input
                id="edit-department"
                value={editForm.department}
                onChange={(e) => setEditForm(prev => ({ ...prev, department: e.target.value }))}
              />
            </div>
            {editForm.role === 'AP_REVIEWER' && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-approvalLimit" className="text-sm font-medium">Approval Limit (AUD)</Label>
                <Input
                  id="edit-approvalLimit"
                  type="number"
                  value={editForm.approvalLimit ?? ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, approvalLimit: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditUser}
              disabled={editLoading || !editForm.firstName || !editForm.lastName || !editForm.email || !editForm.department}
            >
              {editLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
