import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute, PublicOnlyRoute } from '@/components/routing/ProtectedRoute';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RecipesPage } from '@/pages/RecipesPage';
import { RecipeDetailPage } from '@/pages/RecipeDetailPage';
import { RecipeFormPage } from '@/pages/RecipeFormPage';
import { PlannerPage } from '@/pages/PlannerPage';
import { PantryPage } from '@/pages/PantryPage';
import { GroceryPage } from '@/pages/GroceryPage';
import { GroceryDetailPage } from '@/pages/GroceryDetailPage';
import { NutritionPage } from '@/pages/NutritionPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />

        <Route element={<PublicOnlyRoute />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="recipes" element={<RecipesPage />} />
          <Route path="recipes/new" element={<RecipeFormPage mode="create" />} />
          <Route path="recipes/:id" element={<RecipeDetailPage />} />
          <Route path="recipes/:id/edit" element={<RecipeFormPage mode="edit" />} />
          <Route path="planner" element={<PlannerPage />} />
          <Route path="pantry" element={<PantryPage />} />
          <Route path="grocery" element={<GroceryPage />} />
          <Route path="grocery/:id" element={<GroceryDetailPage />} />
          <Route path="nutrition" element={<NutritionPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
